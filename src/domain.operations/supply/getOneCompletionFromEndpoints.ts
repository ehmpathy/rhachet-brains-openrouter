import type { IsoDuration } from 'iso-time';
import type OpenAI from 'openai';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asEndpointTags } from './asEndpointTags';
import { asProviderPreference } from './asProviderPreference';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneCompletionWithinBound } from './getOneCompletionWithinBound';

/**
 * .what = one completion that admits a set of endpoints, with no fallback beyond it
 * .why = the admitted-set path's one i/o hop; openrouter balances within the set
 *        and can never swap in a host outside it
 *
 * .note = the twin of `getOneCompletionFromEndpoint`, which admits one endpoint
 * .note = the request type is the openai sdk's own type name
 * .note = a sort tries hosts in order, so openrouter may fall back within the set:
 *         one throttle must not end the ask. with no sort, fallbacks stay off, as 0.1.3
 * .note = a cut body or a stall raises a `HostFaultError`
 */
export const getOneCompletionFromEndpoints = (
  input: {
    request: OpenAI.ChatCompletionCreateParamsNonStreaming;
    filters: SupplyFilters;
    endpoints: OpenRouterEndpoint[];
    bound: IsoDuration;
  },
  context: { openai: OpenAI },
): Promise<OpenAI.ChatCompletion> => {
  const tags = asEndpointTags({ endpoints: input.endpoints });
  return getOneCompletionWithinBound(
    {
      request: {
        ...input.request,
        // .note = `provider` is openrouter's field, absent from the openai sdk's type; a spread
        //         carries it past the excess-property check, where a bare key would not compile
        ...{
          provider: asProviderPreference({
            filters: input.filters,
            only: tags,
            fallbackWithinOnly: input.filters.sort !== null,
          }),
        },
      },
      tags,
      bound: input.bound,
    },
    context,
  );
};
