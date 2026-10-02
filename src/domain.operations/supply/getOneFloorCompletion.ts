import OpenAI from 'openai';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneCompletionFromEndpoint } from './getOneCompletionFromEndpoint';
import { getOneFloorExhaustedError } from './getOneFloorExhaustedError';
import { isReplyFailed } from './isReplyFailed';
import { isReplyJsonIgnored } from './isReplyJsonIgnored';
import type { SdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';

type ChatRequest = OpenAI.ChatCompletionCreateParamsNonStreaming; // .note = the openai sdk's own type name

/**
 * .what = how a call to an admitted endpoint failed, if it is a failure the walk steps past
 * .why = a 429 (throttle) and a 404 (openrouter cannot reach the admitted endpoint) are
 *        both fast and local to that endpoint: the next endpoint may serve. all else rethrows
 */
const asStepOutcome = (input: {
  error: unknown;
}): 'throttled' | 'refused' | null => {
  if (!(input.error instanceof OpenAI.APIError)) return null;
  if (input.error.status === 429) return 'throttled';
  if (input.error.status === 404) return 'refused';
  return null;
};

/**
 * .what = the `retry-after` a throttle sent, if any
 * .why = case=14 owes the caller the wait openrouter asked for, so a fleet backs
 *        off by the server's clock rather than a guess
 *
 * .note = the headers are checked at runtime, not trusted to the sdk's type: a
 *         shape other than `Headers`, or a blank value, reads as no wait at all
 */
const asRetryAfter = (input: { error: unknown }): string | null => {
  if (!(input.error instanceof OpenAI.APIError)) return null;
  const headers: unknown = input.error.headers;
  if (!(headers instanceof Headers)) return null;
  const value = headers.get('retry-after');
  return value !== null && value.trim() !== '' ? value.trim() : null;
};

/**
 * .what = walks the qualified endpoints cheapest-first, one admitted alone per hop
 * .why = `floor` must land on the cheapest endpoint that serves now; a throttle,
 *        a refusal, or a reply the host failed mid-way steps to the next, never
 *        to a pricier host openrouter picks
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
  attempts: FloorAttempt[];
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
        },
        context,
      );

    return {
      response,
      admitted: [endpoint],
      attempts: [...input.attempts, { tag: endpoint.tag, outcome: 'served' }],
    };
  } catch (error) {
    // a failure the walk cannot step past is the caller's to see, untouched
    const outcome = asStepOutcome({ error });
    if (!outcome) throw error;

    // a refusal proves the cached list stale: drop it, then step
    if (outcome === 'refused')
      await context.sdkOpenRouterEndpoints.delForModel({ model: input.model });
    return getOneFloorCompletion(
      {
        ...input,
        queue: rest,
        attempts: [...input.attempts, { tag: endpoint.tag, outcome }],
        retryAfter: asRetryAfter({ error }) ?? input.retryAfter,
      },
      context,
    );
  }
};
