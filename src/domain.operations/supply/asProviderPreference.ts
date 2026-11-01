import type { SupplySort } from '../../domain.objects/SupplySort';
import type { SupplyFilters } from './asSupplyFilters';

/**
 * .what = the openrouter `provider` preference for a filtered ask
 * .why = each promise maps to a native field; `only` bounds every hop, fallbacks
 *        included, so openrouter can never leave the set we admitted
 *
 * .note = `fallbackWithinOnly` is the caller's call. a floor hop names one tag, so it
 *         sends `false`. a sorted admitted set sends `true`: a sort makes openrouter try
 *         hosts in order, so with fallbacks off a throttled top host would end the ask
 *         while the rest of the set sat idle (F31)
 * .note = `price.max` is one bound on BOTH rates, input and output alike; the
 *         readme says so where the word is defined
 * .note = `sort` is sent only when the slug writes it; unset sends no key, as 0.1.3
 */
export const asProviderPreference = (input: {
  filters: SupplyFilters;
  only: string[];
  fallbackWithinOnly: boolean;
}): {
  only: string[];
  allow_fallbacks: boolean;
  require_parameters: true;
  zdr?: true;
  data_collection?: 'deny';
  quantizations?: string[];
  max_price?: { prompt: number; completion: number };
  sort?: SupplySort;
} => ({
  only: input.only,
  allow_fallbacks: input.fallbackWithinOnly,
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
  ...(input.filters.sort ? { sort: input.filters.sort } : {}),
});
