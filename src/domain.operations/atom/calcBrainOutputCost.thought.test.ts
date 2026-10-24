import { calcBrainOutputCost } from 'rhachet/brains';

import { asBrainSizeForAsk } from './asBrainSizeForAsk';
import { SPEC_ESTIMATE_BY_TIER } from './BrainAtom.config';

/**
 * .what = the cost breakdown never charges thought twice
 * .why = thought tokens are a part of output tokens, never extra. `tokens.thought` now
 *        rides in the size this package hands to rhachet's cost calc (#595); a rhachet
 *        that priced it apart from output would bill the same tokens twice. this clamp
 *        goes red the day that calc changes, before a consumer sees a doubled estimate
 */
describe('calcBrainOutputCost, given a size with thought', () => {
  test('the breakdown equals the one for the same size with no thought', () => {
    const size = asBrainSizeForAsk({
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 900,
        total_tokens: 2100,
        completion_tokens_details: { reasoning_tokens: 700 },
      },
      systemPrompt: null,
      promptText: 'is 17 prime?',
      content: '{"verdict":"yes"}',
    });
    expect(size.tokens.thought).toEqual(700);

    const withThought = calcBrainOutputCost({
      for: { tokens: size.tokens },
      with: { cost: { cash: SPEC_ESTIMATE_BY_TIER.flash.cost.cash } },
    });
    const sansThought = calcBrainOutputCost({
      for: { tokens: { ...size.tokens, thought: null } },
      with: { cost: { cash: SPEC_ESTIMATE_BY_TIER.flash.cost.cash } },
    });
    expect(withThought.cash).toEqual(sansThought.cash);
  });
});
