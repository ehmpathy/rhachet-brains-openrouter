import type { SupplyFunnel } from './SupplyFunnel';

/**
 * .what = why an ask went to the endpoint it did
 * .why = openrouter's endpoint table changes by the minute; the choice names
 *        each promise's toll and, for every cheaper endpoint, the promise it failed
 */
export type SupplyChoice = {
  tokensEstimate: { input: number };
  funnel: SupplyFunnel;
  ranked: {
    tag: string;
    estUsd: number;
    tps: number | null;
    verdict: string; // 'qualified' or the first promise it failed
  }[];
};
