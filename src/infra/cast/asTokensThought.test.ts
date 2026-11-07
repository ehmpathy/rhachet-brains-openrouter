import { asTokensThought } from './asTokensThought';

const TEST_CASES = [
  {
    description: 'reads the thought tokens openrouter reports',
    given: { usage: { completion_tokens_details: { reasoning_tokens: 200 } } },
    expect: 200,
  },
  {
    description: 'a reported zero is zero, never null',
    given: { usage: { completion_tokens_details: { reasoning_tokens: 0 } } },
    expect: 0,
  },
  {
    description: 'a null count is unknown',
    given: { usage: { completion_tokens_details: { reasoning_tokens: null } } },
    expect: null,
  },
  {
    description: 'absent details are unknown',
    given: { usage: { completion_tokens_details: null } },
    expect: null,
  },
  {
    description: 'a usage with no details key is unknown',
    given: { usage: {} },
    expect: null,
  },
  {
    description: 'no usage is unknown',
    given: { usage: null },
    expect: null,
  },
  {
    description: 'an undefined usage is unknown',
    given: { usage: undefined },
    expect: null,
  },
];

describe('asTokensThought', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asTokensThought(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
