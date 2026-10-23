import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';

/**
 * .what = splits endpoints into those a provider serves and the rest
 * .why = a host fault names a provider, never an endpoint; one provider can
 *        serve several endpoints of a model (e.g. fp8 and bf16), and all of
 *        them leave the admitted set together
 *
 * .note = a null provider name matches no endpoint, so `named` is empty
 */
export const asEndpointsSplitByProvider = (input: {
  endpoints: OpenRouterEndpoint[];
  providerName: string | null;
}): { named: OpenRouterEndpoint[]; others: OpenRouterEndpoint[] } => ({
  named: input.endpoints.filter(
    (endpoint) => endpoint.providerName === input.providerName,
  ),
  others: input.endpoints.filter(
    (endpoint) => endpoint.providerName !== input.providerName,
  ),
});
