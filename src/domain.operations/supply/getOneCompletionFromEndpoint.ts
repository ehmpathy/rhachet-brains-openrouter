import type { IsoDuration } from 'iso-time';
import type OpenAI from 'openai';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asProviderPreference } from './asProviderPreference';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneCompletionWithinBound } from './getOneCompletionWithinBound';

/**
 * .what = one completion that admits one endpoint, with no fallback
 * .why = the floor walk's one i/o hop; the walk composes it, and this admits
 *        that endpoint alone so openrouter can never swap in a pricier host
 *
 * .note = the request type is the openai sdk's own type name
 * .note = a cut body or a stall raises a `HostFaultError`, which the walk steps past
 */
export const getOneCompletionFromEndpoint = (
  input: {
    request: OpenAI.ChatCompletionCreateParamsNonStreaming;
    filters: SupplyFilters;
    endpoint: OpenRouterEndpoint;
    bound: IsoDuration;
  },
  context: { openai: OpenAI },
): Promise<OpenAI.ChatCompletion> =>
  getOneCompletionWithinBound(
    {
      request: {
        ...input.request,
        // .note = `provider` is openrouter's field, absent from the openai sdk's type; a spread
        //         carries it past the excess-property check, where a bare key would not compile
        ...{
          provider: asProviderPreference({
            filters: input.filters,
            only: [input.endpoint.tag],
            fallbackWithinOnly: false, // one tag per hop: the walk owns the next step
          }),
        },
      },
      tags: [input.endpoint.tag],
      bound: input.bound,
    },
    context,
  );
