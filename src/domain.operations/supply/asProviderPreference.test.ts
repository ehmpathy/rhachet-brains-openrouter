import { asProviderPreference } from './asProviderPreference';
import type { SupplyFilters } from './asSupplyFilters';

const FILTERS: SupplyFilters = {
  floor: true,
  speedMinTps: null,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
  sort: null,
};

describe('asProviderPreference', () => {
  // .why = each promise is backed by openrouter's own native field, so a
  //        stale cache or a skew in our filter cannot widen the set
  const TEST_CASES = [
    {
      description:
        'no promise beyond the admitted set: fallbacks off, params required',
      given: { filters: FILTERS, fallbackWithinOnly: false },
      expect: {
        allow_fallbacks: false,
        require_parameters: true,
        zdr: undefined,
        quantizations: undefined,
        max_price: undefined,
        sort: undefined, // unset sends no key, as 0.1.3
      },
    },
    {
      description: 'sort=throughput sends provider.sort (case=4)',
      given: {
        filters: { ...FILTERS, sort: 'throughput' as const },
        fallbackWithinOnly: false,
      },
      expect: { sort: 'throughput', allow_fallbacks: false },
    },
    {
      description:
        'a fallback within the admitted set sends allow_fallbacks, still bounded by only (F31)',
      given: {
        filters: { ...FILTERS, floor: false, sort: 'throughput' as const },
        fallbackWithinOnly: true,
      },
      expect: { sort: 'throughput', allow_fallbacks: true },
    },
    {
      description: 'privacy=full sends zdr and data_collection deny',
      given: {
        filters: { ...FILTERS, privacy: 'full' as const },
        fallbackWithinOnly: false,
      },
      expect: { zdr: true, data_collection: 'deny' },
    },
    {
      description: 'precision sends quantizations',
      given: {
        filters: { ...FILTERS, precision: 'fp8' as const },
        fallbackWithinOnly: false,
      },
      expect: { quantizations: ['fp8'] },
    },
    {
      description: 'price.max sends max_price on both rates',
      given: {
        filters: { ...FILTERS, priceMaxUsdPerMillion: 0.5 },
        fallbackWithinOnly: false,
      },
      expect: { max_price: { prompt: 0.5, completion: 0.5 } },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const preference: Record<string, unknown> = asProviderPreference({
        filters: thisCase.given.filters,
        only: ['cheap'],
        fallbackWithinOnly: thisCase.given.fallbackWithinOnly,
      });
      expect(preference.only).toEqual(['cheap']);
      if (thisCase.given.filters.sort === null)
        expect('sort' in preference).toEqual(false);
      for (const [field, value] of Object.entries(thisCase.expect))
        expect(preference[field]).toEqual(value);
    }),
  );
});
