import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';

/**
 * .what = one attempt per endpoint a host fault removed
 * .why = the caller audits each endpoint that left the set, and why it left
 */
export const asSupplyAttemptsOfFault = (input: {
  endpoints: OpenRouterEndpoint[];
  outcome: 'throttled' | 'refused' | 'failed';
}): FloorAttempt[] =>
  input.endpoints.map((endpoint) => ({
    tag: endpoint.tag,
    outcome: input.outcome,
  }));
