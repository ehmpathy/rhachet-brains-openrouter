import type OpenAI from 'openai';

import { asOpenRouterExtras } from './asOpenRouterExtras';

/**
 * .what = the supply facts a reply carries: who served, what it cost, its audit id
 * .why = both the bare and the filtered path report these three, and the reply
 *        defect check reads them; one read keeps every path in step
 */
export const asSupplyFactsFromReply = (input: {
  response: OpenAI.ChatCompletion;
}): {
  provider: string | null;
  costUsd: number | null;
  generationId: string | null;
} => {
  const extras = asOpenRouterExtras({ response: input.response });
  return {
    provider: extras.provider,
    costUsd: extras.costUsd,
    generationId: input.response.id ?? null,
  };
};
