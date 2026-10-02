import type OpenAI from 'openai';

import { asReplyChoice } from './asReplyChoice';

const CHOICE = {
  index: 0,
  logprobs: null,
  finish_reason: 'stop',
  message: { role: 'assistant', content: 'ok', refusal: null },
};

/**
 * .what = a completion body as openrouter may send it
 * .why = the body may lack `choices` entirely, a shape the sdk types forbid;
 *        json round-trip yields the sdk type with no cast
 */
const genResponse = (input: {
  body: Record<string, unknown>;
}): OpenAI.ChatCompletion =>
  JSON.parse(
    JSON.stringify({ id: 'gen-1', object: 'chat.completion', ...input.body }),
  );

describe('asReplyChoice', () => {
  const TEST_CASES = [
    {
      description: 'a body with one choice returns it',
      given: { body: { choices: [CHOICE] } },
      expect: CHOICE,
    },
    {
      description: 'a body with an empty choices array returns null',
      given: { body: { choices: [] } },
      expect: null,
    },
    {
      description:
        'a 200 body with an error in place of choices returns null, never a TypeError',
      given: { body: { error: { message: 'upstream failed', code: 502 } } },
      expect: null,
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(
        asReplyChoice({ response: genResponse({ body: thisCase.given.body }) }),
      ).toEqual(thisCase.expect);
    }),
  );
});
