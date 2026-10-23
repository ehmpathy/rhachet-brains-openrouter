import type OpenAI from 'openai';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asHostFault } from './asHostFault';
import { asRetryAfter } from './asRetryAfter';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneCompletionFromEndpoint } from './getOneCompletionFromEndpoint';
import { getOneFloorExhaustedError } from './getOneFloorExhaustedError';
import { isReplyFailed } from './isReplyFailed';
import { isReplyJsonIgnored } from './isReplyJsonIgnored';
import type { SdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';

type ChatRequest = OpenAI.ChatCompletionCreateParamsNonStreaming; // .note = the openai sdk's own type name

/**
 * .what = walks the qualified endpoints cheapest-first, one admitted alone per hop
 * .why = `floor` must land on the cheapest endpoint that serves now; a host
 *        fault (`asHostFault`) or a reply the host failed mid-way steps to the
 *        next, never to a pricier host openrouter picks
 *
 * .note = a refusal proves the cached endpoint list stale, so the model's entry
 *         is dropped; the next ask reads it live (case=21)
 * .note = a failed reply drops no cache entry: the host is listed and healthy by
 *         openrouter's own read, it only failed this ask (F26)
 * .note = a prose reply where json was owed IS recorded, for 7 days, machine
 *         wide: the host claims the schema and broke it, so every later json ask
 *         skips it rather than pay to learn it again
 * .note = the prose check precedes the failed-reply check: both read a whole
 *         reply, and only a whole reply with `finish_reason: 'stop'` is prose
 */
export const getOneFloorCompletion = async (
  input: {
    model: string;
    request: ChatRequest;
    filters: SupplyFilters;
    expectsJson: boolean;
    queue: OpenRouterEndpoint[];
    attempts: FloorAttempt[];
    retryAfter: string | null; // the latest throttle's `retry-after`, seconds
    faultLast: Error | null; // the last step's own error, for the refusal; null when the last host threw none
  },
  context: {
    openai: OpenAI;
    sdkOpenRouterEndpoints: Pick<
      SdkOpenRouterEndpoints,
      'delForModel' | 'setJsonIgnoredTag'
    >;
  },
): Promise<{
  response: OpenAI.ChatCompletion;
  admitted: OpenRouterEndpoint[]; // the one endpoint that served, admitted alone
  attempts: FloorAttempt[]; // each endpoint stepped past; the serve is the caller's to record
}> => {
  // every qualified endpoint was tried and none served
  const [endpoint, ...rest] = input.queue;
  if (!endpoint) throw getOneFloorExhaustedError(input);

  // admit this endpoint alone, with no fallback
  try {
    const response = await getOneCompletionFromEndpoint(
      { request: input.request, filters: input.filters, endpoint },
      context,
    );

    // a host that answered prose where json was owed broke the schema promise:
    // record it for a week on this machine, then step to the next
    if (isReplyJsonIgnored({ response, expectsJson: input.expectsJson })) {
      await context.sdkOpenRouterEndpoints.setJsonIgnoredTag({
        model: input.model,
        tag: endpoint.tag,
      });
      return getOneFloorCompletion(
        {
          ...input,
          queue: rest,
          attempts: [
            ...input.attempts,
            { tag: endpoint.tag, outcome: 'prose' },
          ],
          faultLast: null, // this host threw no error; an earlier host's is not the last
        },
        context,
      );
    }

    // a host that failed mid-reply did not serve: step to the next
    if (isReplyFailed({ response }))
      return getOneFloorCompletion(
        {
          ...input,
          queue: rest,
          attempts: [
            ...input.attempts,
            { tag: endpoint.tag, outcome: 'failed' },
          ],
          faultLast: null, // this host threw no error; an earlier host's is not the last
        },
        context,
      );

    // the serve itself is recorded by the caller, once for both supply modes
    return { response, admitted: [endpoint], attempts: input.attempts };
  } catch (error) {
    // a failure that is not the host's is the caller's to see, untouched
    const fault = asHostFault({ error });
    if (!fault) throw error;

    // a refusal proves the cached list stale: drop it, then step
    if (fault.outcome === 'refused')
      await context.sdkOpenRouterEndpoints.delForModel({ model: input.model });
    return getOneFloorCompletion(
      {
        ...input,
        queue: rest,
        attempts: [
          ...input.attempts,
          { tag: endpoint.tag, outcome: fault.outcome },
        ],
        retryAfter: asRetryAfter({ error }) ?? input.retryAfter,
        faultLast: error instanceof Error ? error : input.faultLast,
      },
      context,
    );
  }
};
