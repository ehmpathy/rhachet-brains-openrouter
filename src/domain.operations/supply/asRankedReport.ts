import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplyChoice } from '../../domain.objects/SupplyChoice';

/**
 * .what = how many rows past the winner the report keeps
 * .why = three past the winner show the margin; the rest is noise
 */
const ROWS_PAST_WINNER = 3;

/**
 * .what = a usd estimate, to three significant figures
 * .why = the estimate is a ~4-chars-per-token guess; more digits claim a
 *        precision it does not have
 */
const asUsdEstimateRounded = (input: { usd: number }): number =>
  Number(input.usd.toPrecision(3));

/**
 * .what = the rows the report keeps: every endpoint up to the winner, and a few past it
 * .why = the cheaper losers are the ones a caller asks about; each names the
 *        promise it failed
 *
 * .note = a winner absent from the verdicts keeps the head of the list. this is a
 *         guard, unreachable today: the served endpoint comes from the qualified set,
 *         and the verdicts hold every qualified endpoint (F29)
 */
export const asRankedReport = (input: {
  verdicts: {
    endpoint: OpenRouterEndpoint;
    estUsd: number;
    failed: string | null;
  }[];
  servedTag: string;
}): SupplyChoice['ranked'] => {
  // keep the rows through the winner, then a few past it
  const winnerAt = Math.max(
    input.verdicts.findIndex((v) => v.endpoint.tag === input.servedTag),
    0,
  );
  const rowsKept = input.verdicts.slice(0, winnerAt + 1 + ROWS_PAST_WINNER);

  // each row names its tag, its estimate, its speed, and its verdict
  return rowsKept.map((v) => ({
    tag: v.endpoint.tag,
    estUsd: asUsdEstimateRounded({ usd: v.estUsd }),
    tps: v.endpoint.throughputTps,
    verdict: v.failed ?? 'qualified',
  }));
};
