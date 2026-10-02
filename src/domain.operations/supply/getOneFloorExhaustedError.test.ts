import { MalfunctionError } from 'helpful-errors';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import { getOneFloorExhaustedError } from './getOneFloorExhaustedError';

const ATTEMPTS: FloorAttempt[] = [
  { tag: 'cheap/fp8', outcome: 'throttled' },
  { tag: 'mid/fp8', outcome: 'refused' },
  { tag: 'dear/bf16', outcome: 'failed' },
];

/**
 * .why = the fix line has two forms a caller reads: one with openrouter's
 *        retry-after, one without. each is snapped, so drift in either shows
 */
const TEST_CASES = [
  {
    description: 'a walk with a throttle names the wait openrouter asked for',
    given: { retryAfter: '7' },
    expect: { fix: "fix: retry after 7s (openrouter's retry-after)" },
  },
  {
    description: 'a walk with no throttle says to retry later',
    given: { retryAfter: null },
    expect: { fix: 'fix: retry later, or loosen a promise' },
  },
];

describe('getOneFloorExhaustedError', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const error = getOneFloorExhaustedError({
        model: 'deepseek/deepseek-v4.1-flash',
        attempts: ATTEMPTS,
        retryAfter: thisCase.given.retryAfter,
      });
      expect(error).toBeInstanceOf(MalfunctionError);
      expect(error.message).toContain(thisCase.expect.fix);
      expect(error.message).toMatchSnapshot();
    }),
  );
});
