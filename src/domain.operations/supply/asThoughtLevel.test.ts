import { asThoughtLevel } from './asThoughtLevel';

const TEST_CASES = [
  {
    description: 'a level ask names its level',
    given: { reasoning: { effort: 'high' } },
    expect: { output: 'high' },
  },
  {
    description: 'a budget ask names no level',
    given: { reasoning: { max_tokens: 4000 } },
    expect: { output: null },
  },
  {
    description: 'an ask with no cap names no level',
    given: { reasoning: null },
    expect: { output: null },
  },
];

describe('asThoughtLevel', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asThoughtLevel(thisCase.given)).toEqual(thisCase.expect.output);
    }),
  );
});
