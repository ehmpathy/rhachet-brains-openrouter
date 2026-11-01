import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import { getOneStallCount } from './getOneStallCount';

const TEST_CASES: {
  description: string;
  given: { attempts: FloorAttempt[] };
  expect: { output: number };
}[] = [
  {
    description: 'a walk with no attempts counts no stall',
    given: { attempts: [] },
    expect: { output: 0 },
  },
  {
    description: 'only stalled hops count, never another failure',
    given: {
      attempts: [
        { tag: 'a', outcome: 'stalled' },
        { tag: 'b', outcome: 'body-cut' },
        { tag: 'c', outcome: 'throttled' },
        { tag: 'd', outcome: 'stalled' },
        { tag: 'e', outcome: 'served' },
      ],
    },
    expect: { output: 2 },
  },
];

describe('getOneStallCount', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getOneStallCount(thisCase.given)).toEqual(thisCase.expect.output);
    }),
  );
});
