import { asProviderPreference } from './asProviderPreference';
import type { SupplyFilters } from './asSupplyFilters';

const FILTERS: SupplyFilters = {
  floor: true,
  speedMinTps: null,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
};

describe('asProviderPreference', () => {
  // .why = each promise is backed by openrouter's own native field, so a
  //        stale cache or a skew in our filter cannot widen the set
  const TEST_CASES = [
    {
      description:
        'no promise beyond the admitted set: fallbacks off, params required',
      given: { filters: FILTERS },
      expect: {
        allow_fallbacks: false,
        require_parameters: true,
        zdr: undefined,
        quantizations: undefined,
        max_price: undefined,
      },
    },
    {
      description: 'privacy=full sends zdr and data_collection deny',
      given: { filters: { ...FILTERS, privacy: 'full' as const } },
      expect: { zdr: true, data_collection: 'deny' },
    },
    {
      description: 'precision sends quantizations',
      given: { filters: { ...FILTERS, precision: 'fp8' as const } },
      expect: { quantizations: ['fp8'] },
    },
    {
      description: 'price.max sends max_price on both rates',
      given: { filters: { ...FILTERS, priceMaxUsdPerMillion: 0.5 } },
      expect: { max_price: { prompt: 0.5, completion: 0.5 } },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const preference: Record<string, unknown> = asProviderPreference({
        filters: thisCase.given.filters,
        only: ['cheap'],
      });
      expect(preference.only).toEqual(['cheap']);
      for (const [field, value] of Object.entries(thisCase.expect))
        expect(preference[field]).toEqual(value);
    }),
  );
});
