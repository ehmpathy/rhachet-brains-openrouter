import type OpenAI from 'openai';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asProviderPreference } from './asProviderPreference';
import type { SupplyFilters } from './asSupplyFilters';

type ChatRequest = OpenAI.ChatCompletionCreateParamsNonStreaming; // .note = the openai sdk's own type name

/**
 * .what = sends one chat completion that admits every qualified endpoint at once
 * .why = without `floor`, the caller wants any endpoint that keeps each promise;
 *        openrouter balances within the admitted set, and falls back to none outside it
 *
 * .note = the output matches the floor walk's, so the caller reads one shape
 */
export const getOneAdmittedSetCompletion = async (
  input: {
    request: ChatRequest;
    filters: SupplyFilters;
    qualified: OpenRouterEndpoint[];
  },
  context: { openai: OpenAI },
): Promise<{
  response: OpenAI.ChatCompletion;
  admitted: OpenRouterEndpoint[];
  attempts: FloorAttempt[];
}> => {
  // admit the whole qualified set, with no fallback beyond it
  const response = await context.openai.chat.completions.create({
    ...input.request,
    ...{
      provider: asProviderPreference({
        filters: input.filters,
        only: input.qualified.map((endpoint) => endpoint.tag),
      }),
    },
  });

  // no walk was taken, so no hop is reported
  return { response, admitted: input.qualified, attempts: [] };
};
