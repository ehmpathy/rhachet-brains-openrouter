import type OpenAI from 'openai';

import { asSupplyFactsFromReply } from './asSupplyFactsFromReply';

/**
 * .what = a minimal completion, plus whatever extras openrouter attached
 * .why = the openai sdk types omit openrouter's fields; the fixture adds them
 *        as a real reply does, by spread
 */
const genCompletion = (input: {
  id: string;
  extras: Record<string, unknown>;
}): OpenAI.ChatCompletion => ({
  id: input.id,
  object: 'chat.completion',
  created: 0,
  model: 'deepseek/deepseek-v4.1-flash',
  choices: [],
  ...input.extras,
});

describe('asSupplyFactsFromReply', () => {
  const TEST_CASES = [
    {
      description: 'a reply that names its provider and cost yields all three',
      given: {
        response: genCompletion({
          id: 'gen-1',
          extras: {
            provider: 'DeepInfra',
            usage: {
              prompt_tokens: 3,
              completion_tokens: 5,
              total_tokens: 8,
              cost: 0.000012,
            },
          },
        }),
      },
      expect: {
        provider: 'DeepInfra',
        costUsd: 0.000012,
        generationId: 'gen-1',
      },
    },
    {
      description: 'a reply with no provider and no cost yields nulls',
      given: { response: genCompletion({ id: 'gen-2', extras: {} }) },
      expect: { provider: null, costUsd: null, generationId: 'gen-2' },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asSupplyFactsFromReply(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
