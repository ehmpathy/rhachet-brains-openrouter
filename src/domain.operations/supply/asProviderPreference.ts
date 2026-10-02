import type { SupplyFilters } from './asSupplyFilters';

/**
 * .what = the openrouter `provider` preference for a filtered ask
 * .why = each promise maps to a native field; fallbacks are always off, so
 *        openrouter can never leave the set we admitted
 *
 * .note = `price.max` is one bound on BOTH rates, input and output alike; the
 *         readme says so where the word is defined
 */
export const asProviderPreference = (input: {
  filters: SupplyFilters;
  only: string[];
}): {
  only: string[];
  allow_fallbacks: false;
  require_parameters: true;
  zdr?: true;
  data_collection?: 'deny';
  quantizations?: string[];
  max_price?: { prompt: number; completion: number };
} => ({
  only: input.only,
  allow_fallbacks: false,
  require_parameters: true,
  ...(input.filters.privacy === 'full'
    ? { zdr: true, data_collection: 'deny' }
    : {}),
  ...(input.filters.precision
    ? { quantizations: [input.filters.precision] }
    : {}),
  ...(input.filters.priceMaxUsdPerMillion !== null
    ? {
        max_price: {
          prompt: input.filters.priceMaxUsdPerMillion,
          completion: input.filters.priceMaxUsdPerMillion,
        },
      }
    : {}),
});
