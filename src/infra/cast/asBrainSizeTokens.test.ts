import { given, then, when } from 'test-fns';

import { asBrainSizeTokens } from './asBrainSizeTokens';

describe('asBrainSizeTokens', () => {
  given('[case1] a usage with cached tokens', () => {
    // .why = this is the case the cost model turns on. fireworks reports
    //        `prompt_tokens` as the TOTAL with `cached_tokens` a SUBSET, while
    //        rhachet sums input + cache.get as disjoint addends.
    const usage = {
      prompt_tokens: 1000,
      completion_tokens: 50,
      prompt_tokens_details: { cached_tokens: 900 },
    };

    when('[t0] cast', () => {
      then('input excludes the cached portion', () => {
        expect(asBrainSizeTokens({ usage }).input).toEqual(100);
      });

      then('cache.get carries the cached portion', () => {
        expect(asBrainSizeTokens({ usage }).cache.get).toEqual(900);
      });

      then('input + cache.get sums back to the reported total', () => {
        // the disjointness invariant, stated directly: each token billed once
        const size = asBrainSizeTokens({ usage });
        expect(size.input + size.cache.get).toEqual(usage.prompt_tokens);
      });

      then('output passes through', () => {
        expect(asBrainSizeTokens({ usage }).output).toEqual(50);
      });
    });
  });

  given('[case2] a usage with no cache hit', () => {
    when('[t0] prompt_tokens_details is absent', () => {
      then('input carries the whole prompt', () => {
        const size = asBrainSizeTokens({
          usage: { prompt_tokens: 1000, completion_tokens: 50 },
        });
        expect(size.input).toEqual(1000);
        expect(size.cache.get).toEqual(0);
      });
    });

    when('[t1] cached_tokens is zero', () => {
      then('input carries the whole prompt', () => {
        const size = asBrainSizeTokens({
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 50,
            prompt_tokens_details: { cached_tokens: 0 },
          },
        });
        expect(size.input).toEqual(1000);
      });
    });
  });

  given('[case3] a usage the provider reports inconsistently', () => {
    // .why = a cached count above the total would yield a negative token count,
    //        and thus a negative price. clamped rather than trusted.
    when('[t0] cached exceeds prompt', () => {
      then('input clamps at zero, never negative', () => {
        const size = asBrainSizeTokens({
          usage: {
            prompt_tokens: 100,
            completion_tokens: 10,
            prompt_tokens_details: { cached_tokens: 900 },
          },
        });
        expect(size.input).toEqual(0);
      });
    });
  });

  given('[case4] an absent usage', () => {
    // .why = the api may omit usage entirely; a cost of NaN would poison every
    //        downstream sum, so every count reads zero.
    when('[t0] usage is undefined', () => {
      then('every count is zero', () => {
        expect(asBrainSizeTokens({ usage: undefined })).toEqual({
          input: 0,
          output: 0,
          cache: { get: 0, set: 0 },
        });
      });
    });
  });

  given('[case5] any usage at all', () => {
    when('[t0] cast', () => {
      then('cache.set is always zero', () => {
        // .why = fireworks publishes no cache-write rate and returns no write
        //        count, so there is no write to bill.
        expect(
          asBrainSizeTokens({
            usage: {
              prompt_tokens: 1000,
              completion_tokens: 50,
              prompt_tokens_details: { cached_tokens: 900 },
            },
          }).cache.set,
        ).toEqual(0);
      });
    });
  });
});
