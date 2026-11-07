import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { HostFault } from '../../domain.objects/HostFault';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';

/**
 * .what = one attempt per endpoint a host fault removed
 * .why = the caller audits each endpoint that left the set, and why it left
 */
export const asSupplyAttemptsOfFault = (input: {
  endpoints: OpenRouterEndpoint[];
  outcome: HostFault;
}): FloorAttempt[] =>
  input.endpoints.map((endpoint) => ({
    tag: endpoint.tag,
    outcome: input.outcome,
  }));
