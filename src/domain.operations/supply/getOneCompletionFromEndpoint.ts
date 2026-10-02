import type OpenAI from 'openai';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asProviderPreference } from './asProviderPreference';
import type { SupplyFilters } from './asSupplyFilters';

/**
 * .what = one completion that admits one endpoint, with no fallback
 * .why = the floor walk's one i/o hop; the walk composes it, and this admits
 *        that endpoint alone so openrouter can never swap in a pricier host
 *
 * .note = the request type is the openai sdk's own type name
 */
export const getOneCompletionFromEndpoint = (
  input: {
    request: OpenAI.ChatCompletionCreateParamsNonStreaming;
    filters: SupplyFilters;
    endpoint: OpenRouterEndpoint;
  },
  context: { openai: OpenAI },
): Promise<OpenAI.ChatCompletion> =>
  context.openai.chat.completions.create({
    ...input.request,
    ...{
      provider: asProviderPreference({
        filters: input.filters,
        only: [input.endpoint.tag],
      }),
    },
  });
