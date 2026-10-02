import type { FloorAttempt } from './FloorAttempt';
import type { SupplyChoice } from './SupplyChoice';

/**
 * .what = how openrouter supplied an ask — the record a caller reads as `output.supply`
 * .why = a caller audits the supply after the fact: which provider served, the
 *        generation id openrouter keeps, every hop of the walk
 *
 * .note = the charge is not here; it lands in `metrics.cost.cash.total`, the
 *         one place rhachet declares for it
 */
export type SupplyReport = {
  provider: string | null;
  generationId: string | null;
  attempts: FloorAttempt[];
  choice: SupplyChoice | null;
};
