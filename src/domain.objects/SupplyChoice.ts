import type { SupplyFunnel } from './SupplyFunnel';
import type { SupplySort } from './SupplySort';

/**
 * .what = why an ask went to the endpoint it did
 * .why = openrouter's endpoint table changes by the minute; the choice names
 *        each promise's toll and, for every endpoint ranked ahead of the winner
 *        (cheaper under the floor's order, faster under `sort=throughput`), the
 *        promise it failed
 */
export type SupplyChoice = {
  tokensEstimate: { input: number };
  sort: SupplySort | null; // the slug's sort word; null = cheapest input first
  funnel: SupplyFunnel;
  ranked: {
    tag: string;
    estUsd: number;
    tps: number | null;
    verdict: string; // 'qualified' or the first promise it failed
  }[];
};
