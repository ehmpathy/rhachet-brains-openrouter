import { asIsoPrice } from 'iso-price';
import type { calcBrainOutputCost } from 'rhachet/brains';

type CashEstimate = ReturnType<typeof calcBrainOutputCost>['cash'];

/**
 * .what = the cash report: the spec-rate breakdown, with openrouter's charge as the total
 * .why = the breakdown per token kind is only an estimate; the charge openrouter
 *        billed is the truth, so it replaces the total wherever it was sent
 *
 * .note = no charge sent (`costUsd: null`) keeps the estimated total
 * .note = nine decimals: a one-token charge on a cheap model is ~1e-8 usd
 */
export const asCashWithSupplyTotal = (input: {
  estimate: CashEstimate;
  costUsd: number | null;
}): CashEstimate => ({
  ...input.estimate,
  total:
    input.costUsd !== null
      ? asIsoPrice(`USD ${input.costUsd.toFixed(9)}`)
      : input.estimate.total,
});
