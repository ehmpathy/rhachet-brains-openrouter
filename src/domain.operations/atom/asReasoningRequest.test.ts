import { ConstraintError } from 'helpful-errors';
import type { BrainEffort } from 'rhachet/brains';
import { getError } from 'test-fns';

import { asReasoningRequest } from './asReasoningRequest';

const SLUG = 'openrouter/deepseek/flash';

describe('asReasoningRequest', () => {
  const TEST_CASES: {
    description: string;
    given: BrainEffort | null;
    expect: ReturnType<typeof asReasoningRequest>;
  }[] = [
    {
      description: 'unset sends no reasoning key, as 0.1.3 (case=3)',
      given: null,
      expect: null,
    },
    {
      description: 'a budget becomes max_tokens, never effort (case=1)',
      given: { budget: { tokens: 6000 } },
      expect: { max_tokens: 6000 },
    },
    {
      description: 'a level becomes effort, never max_tokens (case=8 [t1])',
      given: { level: 'low' },
      expect: { effort: 'low' },
    },
    {
      description: 'a bare string aliases { level } (case=8 [t0])',
      given: 'low',
      expect: { effort: 'low' },
    },
  ];
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(
        asReasoningRequest({ effort: thisCase.given, slug: SLUG }),
      ).toEqual(thisCase.expect);
    }),
  );

  const REFUSALS: { description: string; given: unknown; why: string }[] = [
    {
      description: 'a zero budget',
      given: { budget: { tokens: 0 } },
      why: 'positive integer',
    },
    {
      description: 'a negative budget',
      given: { budget: { tokens: -200 } },
      why: 'positive integer',
    },
    {
      description: 'a fractional budget',
      given: { budget: { tokens: 1500.5 } },
      why: 'positive integer',
    },
    {
      description: 'an unlisted level, xhigh',
      given: 'xhigh',
      why: 'level not in minimal | low | medium | high',
    },
    {
      description: 'an unlisted level, none',
      given: { level: 'none' },
      why: 'level not in',
    },
    {
      description: 'level and budget together (case=7 [t1])',
      given: { level: 'low', budget: { tokens: 10 } },
      why: 'both level and budget',
    },
    {
      description: 'an empty object',
      given: {},
      why: 'neither level nor budget',
    },
  ];
  REFUSALS.map((thisCase) =>
    test(`refuses ${thisCase.description}, before any call (case=7)`, async () => {
      const error = await getError(() =>
        asReasoningRequest({
          effort: thisCase.given as BrainEffort, // .note = an untyped caller's shape, which the type would refuse. removal: never; this test exists to prove the runtime refusal
          slug: SLUG,
        }),
      );
      expect(error).toBeInstanceOf(ConstraintError);
      expect(error.message).toContain(thisCase.why);
      expect(error.message).toContain('valid shapes, one of:');
      expect(error.message).toMatchSnapshot();
    }),
  );

  test('the refusal names every valid shape', async () => {
    const error = await getError(() =>
      asReasoningRequest({ effort: { budget: { tokens: 0 } }, slug: SLUG }),
    );
    expect(error.message).toMatchSnapshot();
  });
});
