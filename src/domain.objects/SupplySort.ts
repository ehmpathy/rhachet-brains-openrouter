/**
 * .what = the orders a slug's `sort` word may try hosts in
 * .why = openrouter's `provider.sort` takes these three; the floor walk honors `throughput`
 *        and `price` itself, and refuses `latency` until a per-host latency figure is read
 */
export const SUPPLY_SORTS = ['price', 'throughput', 'latency'] as const;
export type SupplySort = (typeof SUPPLY_SORTS)[number];
