import { given, then, when } from 'test-fns';

import { getOnePromptCacheAffinityKey } from './getOnePromptCacheAffinityKey';

const MODEL_FLASH = 'accounts/fireworks/models/deepseek-v4-flash-0731';

describe('getOnePromptCacheAffinityKey', () => {
  given('[case1] a system prompt', () => {
    when('[t0] the same model and system prompt are keyed twice', () => {
      then('the key is identical', () => {
        const input = {
          model: MODEL_FLASH,
          systemPrompt: 'you are a surf instructor',
        };
        expect(getOnePromptCacheAffinityKey(input)).toEqual(
          getOnePromptCacheAffinityKey(input),
        );
      });
    });

    when('[t1] the key is read', () => {
      then('it carries the rhachet-fireworks prefix', () => {
        const key = getOnePromptCacheAffinityKey({
          model: MODEL_FLASH,
          systemPrompt: 'you are a surf instructor',
        });
        expect(key).toMatch(/^rhachet-fireworks-[0-9a-f]{32}$/);
      });

      then('it leaks no system prompt content', () => {
        const key = getOnePromptCacheAffinityKey({
          model: MODEL_FLASH,
          systemPrompt: 'the secret code is ZEBRA42',
        });
        expect(key).not.toContain('ZEBRA42');
      });
    });
  });

  given('[case2] two requests that share a prefix', () => {
    // .why = this is the whole point. a key that varied per prompt or per turn
    //        would pin each call to its own replica and never hit the cache.
    when('[t0] only the user prompt differs', () => {
      then('both requests key to the same replica', () => {
        // the user prompt is absent from the key by construction, so any two
        // calls that share a system prompt share a key
        const of = { model: MODEL_FLASH, systemPrompt: 'you are a surf coach' };
        expect(getOnePromptCacheAffinityKey(of)).toEqual(
          getOnePromptCacheAffinityKey(of),
        );
      });
    });
  });

  given('[case3] two requests with no prefix in common', () => {
    when('[t0] the system prompts differ', () => {
      then('the keys differ', () => {
        expect(
          getOnePromptCacheAffinityKey({
            model: MODEL_FLASH,
            systemPrompt: 'role a',
          }),
        ).not.toEqual(
          getOnePromptCacheAffinityKey({
            model: MODEL_FLASH,
            systemPrompt: 'role b',
          }),
        );
      });
    });

    when('[t1] the models differ', () => {
      then('the keys differ', () => {
        const systemPrompt = 'you are a surf instructor';
        expect(
          getOnePromptCacheAffinityKey({ model: MODEL_FLASH, systemPrompt }),
        ).not.toEqual(
          getOnePromptCacheAffinityKey({
            model: 'accounts/fireworks/models/glm-5p2',
            systemPrompt,
          }),
        );
      });
    });
  });

  given('[case4] an absent system prompt', () => {
    // .why = with no briefs there is no prefix to share. one constant key would
    //        funnel every brief-less call of a model onto one replica, for no
    //        cache gain.
    when('[t0] systemPrompt is undefined', () => {
      then('the key is null', () => {
        expect(
          getOnePromptCacheAffinityKey({
            model: MODEL_FLASH,
            systemPrompt: undefined,
          }),
        ).toBeNull();
      });
    });

    when('[t1] systemPrompt is empty', () => {
      then('the key is null', () => {
        expect(
          getOnePromptCacheAffinityKey({
            model: MODEL_FLASH,
            systemPrompt: '',
          }),
        ).toBeNull();
      });
    });
  });
});
