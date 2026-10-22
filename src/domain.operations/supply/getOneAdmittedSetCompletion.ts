import type { IsoDuration } from 'iso-time';
import type OpenAI from 'openai';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asEndpointsSplitByProvider } from './asEndpointsSplitByProvider';
import { asHostFault } from './asHostFault';
import { asRetryAfter } from './asRetryAfter';
import { asSupplyAttemptsOfFault } from './asSupplyAttemptsOfFault';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneCompletionFromEndpoints } from './getOneCompletionFromEndpoints';
import { getOneFloorCompletion } from './getOneFloorCompletion';
import { getOneFloorExhaustedError } from './getOneFloorExhaustedError';
import type { SdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';
import { setHostFaultNoted } from './setHostFaultNoted';

type ChatRequest = OpenAI.ChatCompletionCreateParamsNonStreaming; // .note = the openai sdk's own type name

/**
 * .what = sends one chat completion that admits every qualified endpoint at once,
 *         and hops past a host that faults
 * .why = without `floor`, the caller wants any endpoint that keeps each promise;
 *        openrouter balances within the admitted set, and falls back to none
 *        outside it. a host fault (`asHostFault`) drops that host and re-sends,
 *        so one throttled or broken host never fails the ask (#21)
 *
 * .note = a fault that names an admitted host drops that host: the name is the
 *         one proof of which host faulted, so each hop strictly shrinks the set
 * .note = a fault openrouter marks as a host's (`Provider returned error`, or a
 *         name) that names no admitted host cannot say which host to drop, so
 *         the rest of the ask walks the set one endpoint per send, as the floor
 *         walk does (F8). each send there names its host by `only`, so it ends
 * .note = a fault with no mark is openrouter's own answer — its normalized
 *         `429 Rate limit exceeded` (its account limit), or a 404 for a
 *         withdrawn model. no other host can fix it, and a walk would only
 *         prolong the limit, so it rethrows untouched in one send (c9)
 * .note = a cut body or a stall marks no host, so it too rethrows untouched: no
 *         name says which host to drop, and a walk would wait out a bound per host
 * .note = side effect: what a fault proves about the cache (`setHostFaultNoted`) is
 *         noted before any hop, walk, or rethrow — a refusal (404) drops the model's
 *         cached endpoint list, named or not; the next read refetches it
 * .note = side effect, once walked: the walk is the floor walk's own, so a json
 *         ask that meets a prose reply there steps past it and records that host
 *         as json-ignored for 7 days, as a floor walk does (F31)
 * .note = the output matches the floor walk's, so the caller reads one shape;
 *         `admitted` is the final set, which the served check reads
 */
export const getOneAdmittedSetCompletion = async (
  input: {
    model: string;
    request: ChatRequest;
    filters: SupplyFilters;
    expectsJson: boolean; // for the floor walk this path falls back to
    qualified: OpenRouterEndpoint[];
    attempts: FloorAttempt[];
    retryAfter: string | null; // the latest throttle's `retry-after`, seconds
    faultLast: Error | null; // the last host fault's own error, for the refusal
    bound: IsoDuration; // each send's bound, body included
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
  admitted: OpenRouterEndpoint[];
  attempts: FloorAttempt[];
}> => {
  // every qualified endpoint faulted and none served
  if (input.qualified.length === 0)
    throw getOneFloorExhaustedError({
      model: input.model,
      attempts: input.attempts,
      retryAfter: input.retryAfter,
      faultLast: input.faultLast,
      untried: 0,
      bound: input.bound,
    });

  // admit the whole set, with no fallback beyond it
  try {
    const response = await getOneCompletionFromEndpoints(
      {
        request: input.request,
        filters: input.filters,
        endpoints: input.qualified,
        bound: input.bound,
      },
      context,
    );
    return { response, admitted: input.qualified, attempts: input.attempts };
  } catch (error) {
    // a failure that is not the host's is the caller's to see, untouched
    const fault = asHostFault({ error });
    if (!fault) throw error;

    // split the set into the hosts the fault names and the rest
    const { named: endpointsFaulted, others: endpointsLeft } =
      asEndpointsSplitByProvider({
        endpoints: input.qualified,
        providerName: fault.providerName,
      });
    const retryAfter = asRetryAfter({ error }) ?? input.retryAfter;
    const faultLast = error instanceof Error ? error : input.faultLast;

    // note what the fault proves about the cache, named or not
    await setHostFaultNoted(
      {
        fault: fault.outcome,
        model: input.model,
        tag: endpointsFaulted[0]?.tag ?? null,
      },
      context,
    );

    // openrouter's own answer (its account limit, a withdrawn model), or a
    // transport fault, marks no host: the caller sees it untouched (c9)
    if (endpointsFaulted.length === 0 && !fault.isHostMarked) throw error;

    // a host's fault that names no admitted host: walk the set one per send
    if (endpointsFaulted.length === 0)
      return getOneFloorCompletion(
        {
          model: input.model,
          request: input.request,
          filters: input.filters,
          expectsJson: input.expectsJson,
          queue: input.qualified,
          attempts: input.attempts,
          retryAfter,
          faultLast,
          bound: input.bound,
        },
        context,
      );

    // hop: re-send to the hosts left, with each removed endpoint on record
    return getOneAdmittedSetCompletion(
      {
        ...input,
        qualified: endpointsLeft,
        attempts: [
          ...input.attempts,
          ...asSupplyAttemptsOfFault({
            endpoints: endpointsFaulted,
            outcome: fault.outcome,
          }),
        ],
        retryAfter,
        faultLast,
      },
      context,
    );
  }
};
