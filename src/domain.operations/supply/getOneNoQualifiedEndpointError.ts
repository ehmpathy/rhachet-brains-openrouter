import { ConstraintError } from 'helpful-errors';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplySort } from '../../domain.objects/SupplySort';
import type { SupplyFilters } from './asSupplyFilters';

/**
 * .what = the heading of the refusal table, in the order its rows rank
 * .why = under `sort=throughput` the rows run fastest first, so the heading says so
 */
const asVerdictTableHeading = (input: { sort: SupplySort | null }): string =>
  input.sort === 'throughput'
    ? 'each endpoint, fastest first, and the promise it fails:'
    : 'each endpoint, cheapest input rate first, and the promise it fails:';

/**
 * .what = one row of the refusal table: an endpoint, its input rate, the promise it fails
 * .why = case=4 owes the caller each endpoint and why it lost, in rank order
 */
const asVerdictRow = (input: {
  endpoint: OpenRouterEndpoint;
  failed: string | null;
}): string => {
  const ratePerMillion = input.endpoint.pricePromptUsdPerToken * 1e6;
  const rate = Number.isFinite(ratePerMillion)
    ? `$${Number(ratePerMillion.toPrecision(3))}/M`
    : 'no rate';
  return `  ${rate.padEnd(10)} ${input.endpoint.tag.padEnd(28)} ✗ ${input.failed}`;
};

/**
 * .what = the error for a filtered ask where no endpoint keeps every promise
 * .why = the caller sees each promise's toll, each endpoint and the promise it
 *        failed, and the fix of the step that emptied the set; no call is sent
 */
export const getOneNoQualifiedEndpointError = (input: {
  model: string;
  filters: SupplyFilters;
  funnel: { promise: string; left: number }[];
  verdicts: { endpoint: OpenRouterEndpoint; failed: string | null }[];
  fix: string; // the fix of the check that emptied the funnel
}): ConstraintError<{ model: string; filters: SupplyFilters }> =>
  new ConstraintError(
    [
      `no endpoint of ${input.model} keeps every promise. no call was sent.`,
      '',
      ...input.funnel.map(
        (f) => `  ${String(f.left).padStart(3)} ← ${f.promise}`,
      ),
      '',
      asVerdictTableHeading({ sort: input.filters.sort }),
      ...input.verdicts.map(asVerdictRow),
      '',
      input.fix,
    ].join('\n'),
    { model: input.model, filters: input.filters },
  );
