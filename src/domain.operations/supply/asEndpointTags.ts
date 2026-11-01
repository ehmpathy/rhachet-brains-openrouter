import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';

/**
 * .what = the host tags of a set of endpoints, in their order
 * .why = openrouter admits hosts by tag (`provider.only`), and a fault names them by tag
 */
export const asEndpointTags = (input: {
  endpoints: OpenRouterEndpoint[];
}): string[] => input.endpoints.map((endpoint) => endpoint.tag);
