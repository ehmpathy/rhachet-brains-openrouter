import { createCache } from 'simple-on-disk-cache';
import { genTempDir, given, then, useThen, when } from 'test-fns';

import { genZdrRefreshClaim } from './genZdrRefreshClaim';

/**
 * .what = a fresh on-disk cache in its own temp dir
 * .why = the claim arbitrates on the physical disk entry; an integration test
 *        must use a real disk, never a fake
 */
const genCache = () =>
  createCache({ directory: { local: { path: genTempDir() } } });

describe('genZdrRefreshClaim', () => {
  // 🔴 .why = i003 review: the in-memory dedupe let each process start its own
  //           ~1.17MB read. a fleet of six fresh processes must start one
  given('[case1] six claims race on one disk', () => {
    when('[t0] they all claim at once', () => {
      const scene = useThen('every claim settles', async () => {
        const cache = genCache();
        const claims = await Promise.all(
          Array.from({ length: 6 }, () =>
            genZdrRefreshClaim(
              { key: 'zdr.refresh.claim', minutes: 5 },
              { cache },
            ),
          ),
        );
        return { winners: claims.filter((claim) => claim.won).length };
      });

      then('exactly one wins', () => {
        expect(scene.winners).toEqual(1);
      });
    });
  });

  given('[case2] a claim already held', () => {
    when('[t0] a second process claims', () => {
      const scene = useThen('both claims settle', async () => {
        const cache = genCache();
        const first = await genZdrRefreshClaim(
          { key: 'zdr.refresh.claim', minutes: 5 },
          { cache },
        );
        const second = await genZdrRefreshClaim(
          { key: 'zdr.refresh.claim', minutes: 5 },
          { cache },
        );
        return { first: first.won, second: second.won };
      });

      then('the first wins and the second skips', () => {
        expect(scene).toEqual({ first: true, second: false });
      });
    });
  });
});
