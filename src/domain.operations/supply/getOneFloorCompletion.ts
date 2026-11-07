import type { IsoDuration } from 'iso-time';
import type OpenAI from 'openai';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asHostFault } from './asHostFault';
import { asRetryAfter } from './asRetryAfter';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneCompletionFromEndpoint } from './getOneCompletionFromEndpoint';
import { getOneFloorExhaustedError } from './getOneFloorExhaustedError';
import { getOneStallCount } from './getOneStallCount';
import type { SdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';
import { setHostFaultNoted } from './setHostFaultNoted';

type ChatRequest = OpenAI.ChatCompletionCreateParamsNonStreaming; // .note = the openai sdk's own type name

/**
 * .what = the most stalled hosts one floor walk waits out before it stops
 * .why = each stall costs a full per-hop bound; with no cap, a walk over N stalled
 *        hosts holds the caller N bounds. two stalls signal trouble beyond
 *        one host, so the walk stops there and names the hosts it left untried
 */
const STALLS_PER_WALK_MAX = 2;

/**
 * .what = one hop's outcome: the reply or the error, plus the host fault it shows
 * .why = the walk branches on one verdict (asHostFault), whichever way the call
 *        settled; this folds both ways into that one shape
 */
const getOneHopVerdict = async (input: {
  call: Promise<OpenAI.ChatCompletion>;
  expectsJson: boolean;
}): Promise<
  | {
      response: OpenAI.ChatCompletion;
      error: null;
      fault: ReturnType<typeof asHostFault>;
    }
  | { response: null; error: unknown; fault: ReturnType<typeof asHostFault> }
> =>
  input.call.then(
    (response) => ({
      response,
      error: null,
      fault: asHostFault({ response, expectsJson: input.expectsJson }),
    }),
    (error: unknown) => ({
      response: null,
      error,
      fault: asHostFault({ error }),
    }),
  );

/**
 * .what = walks the qualified endpoints in queue order, one admitted alone per hop
 * .why = `floor` must land on the first qualified endpoint that serves now; each host
 *        fault `asHostFault` names (throttle, refusal, a marked 400, 502/503/504, a
 *        failed reply, prose or 0 chars where json was owed, cut body, stall) steps to
 *        the next in queue order, never to a host openrouter picks
 *
 * .note = the queue order is the slug's: cheapest input first, or fastest first under
 *         `sort=throughput` (getAllQualifiedEndpoints)
 * .note = what each fault proves about the cache is `setHostFaultNoted`'s call
 * .note = a reply cut at the output limit is no host fault, so it never steps:
 *         another host would spend the same thought again
 * .note = the serve itself is recorded by the caller, once for both supply modes
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
    bound: IsoDuration; // each hop's bound, body included
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
  if (!endpoint) throw getOneFloorExhaustedError({ ...input, untried: 0 });

  // enough hosts stalled to signal trouble beyond one host: stop, name the rest
  if (getOneStallCount({ attempts: input.attempts }) >= STALLS_PER_WALK_MAX)
    throw getOneFloorExhaustedError({ ...input, untried: input.queue.length });

  // admit this endpoint alone, with no fallback; read the host's verdict
  const hop = await getOneHopVerdict({
    call: getOneCompletionFromEndpoint(
      {
        request: input.request,
        filters: input.filters,
        endpoint,
        bound: input.bound,
      },
      context,
    ),
    expectsJson: input.expectsJson,
  });

  // the host served, or failed in a way the walk cannot step past: the caller's, untouched
  const { fault } = hop;
  if (fault === null && hop.response !== null)
    return {
      response: hop.response,
      admitted: [endpoint],
      attempts: input.attempts,
    };
  if (fault === null) throw hop.error;

  // the host faulted: note what the fault proves, then step to the next
  await setHostFaultNoted(
    { fault: fault.outcome, model: input.model, tag: endpoint.tag },
    context,
  );
  return getOneFloorCompletion(
    {
      ...input,
      queue: rest,
      attempts: [
        ...input.attempts,
        { tag: endpoint.tag, outcome: fault.outcome },
      ],
      retryAfter: asRetryAfter({ error: hop.error }) ?? input.retryAfter,
      faultLast: hop.error instanceof Error ? hop.error : null, // a reply fault threw no error; an earlier host's is not the last
    },
    context,
  );
};
