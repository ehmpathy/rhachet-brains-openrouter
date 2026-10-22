import { isThoughtCapIgnored } from './isThoughtCapIgnored';

const TEST_CASES = [
  {
    description: 'thought under the budget honors the cap',
    given: { tokensThought: 280, tokensThoughtBudget: 400 },
    expect: { output: false },
  },
  {
    description: 'thought a little past the budget still honors the cap',
    given: { tokensThought: 590, tokensThoughtBudget: 400 },
    expect: { output: false },
  },
  {
    description: 'thought far past the budget ignores the cap',
    given: { tokensThought: 1000, tokensThoughtBudget: 400 },
    expect: { output: true },
  },
  {
    description: 'no budget sent is no cap to ignore',
    given: { tokensThought: 5000, tokensThoughtBudget: null },
    expect: { output: false },
  },
  {
    description: 'no thought reported is no proof of a breach',
    given: { tokensThought: null, tokensThoughtBudget: 400 },
    expect: { output: false },
  },
];

describe('isThoughtCapIgnored', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isThoughtCapIgnored(thisCase.given)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
