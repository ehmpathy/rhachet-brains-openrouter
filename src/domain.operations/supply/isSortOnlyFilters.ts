import { SUPPLY_FILTERS_NONE, type SupplyFilters } from './asSupplyFilters';

/**
 * .what = whether a slug's filters set a sort word and no promise
 * .why = `sort` orders hosts and promises naught about them, so a segment of `sort` alone
 *        keeps the default promises and adds the order. a sort word must never drop
 *        zero data retention by accident
 *
 * .note = compared against SUPPLY_FILTERS_NONE whole, so a promise field added to
 *         SupplyFilters is read here with no edit, never skipped
 */
export const isSortOnlyFilters = (input: { filters: SupplyFilters }): boolean =>
  input.filters.sort !== null &&
  JSON.stringify({ ...SUPPLY_FILTERS_NONE, ...input.filters, sort: null }) ===
    JSON.stringify(SUPPLY_FILTERS_NONE);
