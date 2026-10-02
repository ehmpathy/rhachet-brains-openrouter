import type OpenAI from 'openai';

import { asOpenRouterExtras } from './asOpenRouterExtras';

/**
 * .what = a minimal completion, plus whatever extras openrouter attached
 * .why = the openai sdk types omit openrouter's fields; the fixture adds them
 *        as a real reply does, by spread
 */
const genCompletion = (input: {
  extras: Record<string, unknown>;
  usage: Record<string, unknown> | null;
}): OpenAI.ChatCompletion => ({
  id: 'gen-1',
  object: 'chat.completion',
  created: 0,
  model: 'deepseek/deepseek-v4.1-flash',
  choices: [],
  ...(input.usage
    ? {
        usage: {
          prompt_tokens: 3,
          completion_tokens: 5,
          total_tokens: 8,
          ...input.usage,
        },
      }
    : {}),
  ...input.extras,
});

describe('asOpenRouterExtras', () => {
  const TEST_CASES = [
    {
      description: 'a reply that names its provider and cost yields both',
      given: { extras: { provider: 'DeepInfra' }, usage: { cost: 0.000012 } },
      expect: { provider: 'DeepInfra', costUsd: 0.000012, errorMessage: null },
    },
    {
      description: 'a reply with neither yields nulls, never a guess',
      given: { extras: {}, usage: null },
      expect: { provider: null, costUsd: null, errorMessage: null },
    },
    {
      description: 'a provider that is not a string is read as absent',
      given: { extras: { provider: 42 }, usage: null },
      expect: { provider: null, costUsd: null, errorMessage: null },
    },
    {
      description: 'a cost sent as a numeric string is read as its number',
      given: { extras: {}, usage: { cost: '0.000012' } },
      expect: { provider: null, costUsd: 0.000012, errorMessage: null },
    },
    {
      description: 'a cost that is not a number in any form is read as absent',
      given: { extras: {}, usage: { cost: 'free' } },
      expect: { provider: null, costUsd: null, errorMessage: null },
    },
    {
      description: 'a 200 body that carries an error yields its message',
      given: {
        extras: { error: { message: 'upstream failed', code: 502 } },
        usage: null,
      },
      expect: {
        provider: null,
        costUsd: null,
        errorMessage: 'upstream failed',
      },
    },
    {
      description: 'an error with no string message is read as absent',
      given: { extras: { error: { code: 502 } }, usage: null },
      expect: { provider: null, costUsd: null, errorMessage: null },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(
        asOpenRouterExtras({ response: genCompletion(thisCase.given) }),
      ).toEqual(thisCase.expect);
    }),
  );
});
