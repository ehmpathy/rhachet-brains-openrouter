import { type IsoDuration, sumDurations, toMilliseconds } from 'iso-time';
import OpenAI from 'openai';

import { HostFaultError } from '../../domain.objects/HostFaultError';
import { isBodyCutError } from './isBodyCutError';

/**
 * .what = how far the sdk's own timer sits past the bound
 * .why = the bound must always fire first, so a stall is named by this race
 */
const SDK_TIMEOUT_MARGIN: IsoDuration = { minutes: 1 };

/**
 * .what = one chat completion, bounded end to end, with transport faults named
 * .why = the sdk `timeout` stops at the headers, so a host that stalls its body
 *        hangs past it; this race bounds the body too, and the abort frees the
 *        socket. a body the host cuts short, and a timeout the sdk raises, both
 *        become a `HostFaultError` the walk can step past
 *
 * .note = the request type is the openai sdk's own type name
 */
export const getOneCompletionWithinBound = async (
  input: {
    request: OpenAI.ChatCompletionCreateParamsNonStreaming;
    tags: string[]; // the hosts this call admits, named in a fault
    bound: IsoDuration;
  },
  context: { openai: OpenAI },
): Promise<OpenAI.ChatCompletion> => {
  // race the whole call against the bound; the abort frees the socket
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), toMilliseconds(input.bound));
  const stalled = new Promise<never>((_, reject) =>
    abort.signal.addEventListener('abort', () =>
      reject(
        new HostFaultError({
          fault: 'stalled',
          tags: input.tags,
          bound: input.bound,
        }),
      ),
    ),
  );
  // .note = the sdk's default retries stay, so one hop may send up to three
  //         requests, all inside the one bound
  const call = context.openai.chat.completions.create(input.request, {
    signal: abort.signal,
    timeout: toMilliseconds(sumDurations(input.bound, SDK_TIMEOUT_MARGIN)),
  });

  // .note = no catch is attached to `call` alone: `Promise.race` subscribes to both
  //         inputs, so a rejection that lands after the race settled is still handled
  try {
    return await Promise.race([call, stalled]);
  } catch (error) {
    // a body the host cut short: a parse fault, or the socket died mid-body
    if (isBodyCutError({ error }))
      throw new HostFaultError({
        fault: 'body-cut',
        tags: input.tags,
        bound: input.bound,
      });

    // a call the bound aborted, or the sdk's own timer ended, surfaces as a stall
    const isBoundAbort =
      abort.signal.aborted && error instanceof OpenAI.APIUserAbortError;
    if (isBoundAbort || error instanceof OpenAI.APIConnectionTimeoutError)
      throw new HostFaultError({
        fault: 'stalled',
        tags: input.tags,
        bound: input.bound,
      });
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
