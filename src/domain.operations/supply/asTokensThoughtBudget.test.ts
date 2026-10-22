import { asTokensThoughtBudget } from './asTokensThoughtBudget';

const TEST_CASES = [
  {
    description: 'a budget reads its tokens',
    given: { reasoning: { max_tokens: 6000 } },
    expect: 6000,
  },
  {
    description: 'a level carries no budget',
    given: { reasoning: { effort: 'low' } },
    expect: null,
  },
  {
    description: 'no effort carries no budget',
    given: { reasoning: null },
    expect: null,
  },
];

describe('asTokensThoughtBudget', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asTokensThoughtBudget(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
