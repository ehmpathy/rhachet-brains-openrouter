import type { FloorAttempt } from './FloorAttempt';
import type { SupplyChoice } from './SupplyChoice';

/**
 * .what = how openrouter supplied an ask — the record a caller reads as `output.supply`
 * .why = a caller audits the supply after the fact: which provider served, the
 *        generation id openrouter keeps, every hop past a host
 *
 * .note = `attempts` lists each endpoint passed over, in order, in both supply
 *         modes; the last row is the serve. a floor walk lists every endpoint it
 *         sent to; the admitted set lists each endpoint it dropped after a host
 *         fault — every tag of the named provider, whether or not that tag served
 *         the send
 * .note = the charge is not here; it lands in `metrics.cost.cash.total`, the
 *         one place rhachet declares for it
 */
export type SupplyReport = {
  provider: string | null;
  generationId: string | null;
  attempts: FloorAttempt[];
  choice: SupplyChoice | null;
};
