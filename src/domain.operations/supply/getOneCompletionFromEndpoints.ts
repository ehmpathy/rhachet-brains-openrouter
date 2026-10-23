import type OpenAI from 'openai';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asProviderPreference } from './asProviderPreference';
import type { SupplyFilters } from './asSupplyFilters';

/**
 * .what = one completion that admits a set of endpoints, with no fallback beyond it
 * .why = the admitted-set path's one i/o hop; openrouter balances within the set
 *        and can never swap in a host outside it
 *
 * .note = the twin of `getOneCompletionFromEndpoint`, which admits one endpoint
 * .note = the request type is the openai sdk's own type name
 */
export const getOneCompletionFromEndpoints = (
  input: {
    request: OpenAI.ChatCompletionCreateParamsNonStreaming;
    filters: SupplyFilters;
    endpoints: OpenRouterEndpoint[];
  },
  context: { openai: OpenAI },
): Promise<OpenAI.ChatCompletion> =>
  context.openai.chat.completions.create({
    ...input.request,
    ...{
      provider: asProviderPreference({
        filters: input.filters,
        only: input.endpoints.map((endpoint) => endpoint.tag),
      }),
    },
  });
