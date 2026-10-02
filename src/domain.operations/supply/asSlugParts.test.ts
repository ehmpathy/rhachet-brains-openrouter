import { ConstraintError } from 'helpful-errors';
import { getError } from 'test-fns';

import { asSlugParts } from './asSlugParts';

describe('asSlugParts', () => {
  const TEST_CASES = [
    {
      description: 'a bare static slug has no filters',
      given: { slug: 'openrouter/deepseek/flash' },
      expect: { base: 'openrouter/deepseek/flash', filters: null },
    },
    {
      description: 'a `/latest` segment is part of the base, never a filter',
      given: { slug: 'openrouter/deepseek/flash/latest' },
      expect: { base: 'openrouter/deepseek/flash/latest', filters: null },
    },
    {
      description: 'the wish form splits base from filters',
      given: { slug: 'openrouter/deepseek/flash/floor&speed=min50tps' },
      expect: {
        base: 'openrouter/deepseek/flash',
        filters: { floor: true, speedMinTps: 50 },
      },
    },
    {
      description: 'an unlisted id keeps its two segments; filters split off',
      given: { slug: 'openrouter/z-ai/glm-5.3/privacy=full' },
      expect: {
        base: 'openrouter/z-ai/glm-5.3',
        filters: { floor: false, privacy: 'full' },
      },
    },
    // 🔴 .why = i003: the `price.max` unit holds a slash (`usd/M`). a split at the
    //           last slash took `M` as the segment, and read the whole slug as a
    //           model id — so the readme's own price.max slug could never be supplied
    {
      description:
        'a price.max word, whose unit holds a slash, stays one filter segment',
      given: { slug: 'openrouter/deepseek/flash/floor&price.max=0.5usd/M' },
      expect: {
        base: 'openrouter/deepseek/flash',
        filters: { floor: true, priceMaxUsdPerMillion: 0.5 },
      },
    },
    {
      description: 'price.max on an unlisted id splits the same way',
      given: { slug: 'openrouter/z-ai/glm-5.3/price.max=2usd/M&privacy=full' },
      expect: {
        base: 'openrouter/z-ai/glm-5.3',
        filters: { priceMaxUsdPerMillion: 2, privacy: 'full' },
      },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const parts = asSlugParts(thisCase.given);
      expect(parts.base).toEqual(thisCase.expect.base);

      // the filter suffix is the slug past its base, verbatim, slash and all
      expect(parts.filterSuffix).toEqual(
        thisCase.given.slug.slice(thisCase.expect.base.length),
      );
      if (thisCase.expect.filters === null)
        return expect(parts.filters).toBeNull();
      expect(parts.filters).toMatchObject(thisCase.expect.filters);
    }),
  );

  test('a literal pattern is refused: a pattern names no model (case=20)', async () => {
    const error = await getError(() =>
      asSlugParts({ slug: 'openrouter/*/*/*' }),
    );
    expect(error).toBeInstanceOf(ConstraintError);
    expect(error.message).toContain('routed pattern');
    expect(error.message).toMatchSnapshot();
  });

  // 🔴 .why = case=3: a filter segment with one bad word must be refused at
  //           parse, and name that word — never fall through to "names no model"
  const BAD_FILTER_CASES = [
    { slug: 'openrouter/deepseek/flash/floor&cheap', word: 'cheap' },
    { slug: 'openrouter/deepseek/flash/fast&speed=min50tps', word: 'fast' },
    { slug: 'openrouter/acme/new-model/floor&', word: '' },
  ];

  BAD_FILTER_CASES.map((thisCase) =>
    test(`a filter segment with a bad word is refused at parse: ${thisCase.slug}`, async () => {
      const error = await getError(() => asSlugParts({ slug: thisCase.slug }));
      expect(error).toBeInstanceOf(ConstraintError);
      expect(error.message).not.toContain('names no openrouter model');
      if (thisCase.word) expect(error.message).toContain(thisCase.word);
      expect(error.message).toMatchSnapshot();
    }),
  );
});
