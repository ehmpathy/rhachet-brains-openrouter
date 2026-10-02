import { ConstraintError } from 'helpful-errors';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplyFilters } from './asSupplyFilters';

/**
 * .what = is this endpoint tag in a usa region
 * .why = a provider's domicile is not its datacenter; only a region tag
 *        (`provider/us`, `provider/us-east`) qualifies, never a base tag
 *
 * .note = only the `us` form openrouter publishes (F1); an unseen `usa` part is
 *         not assumed to name the same region
 */
const isUsaTag = (input: { tag: string }): boolean =>
  input.tag
    .split('/')
    .slice(1)
    .some((part) => /^us(-|$)/.test(part));

/**
 * .what = an endpoint's estimated input charge for this ask, in usd
 * .why = the floor ranks by input cost alone (F20, wisher ruled); output rates
 *        never move the rank
 */
const getOneEndpointCostEstimate = (input: {
  endpoint: OpenRouterEndpoint;
  tokens: { input: number };
}): number => input.tokens.input * input.endpoint.pricePromptUsdPerToken;

/**
 * .what = a cost the sort can order; an unpriced endpoint sorts last
 * .why = an endpoint with no rate reads as NaN, and NaN breaks the comparator —
 *        it could head the floor. no rate is never "cheapest"
 */
const asSortableCost = (estUsd: number): number =>
  Number.isFinite(estUsd) ? estUsd : Number.POSITIVE_INFINITY;

/**
 * .what = one promise, as a check an endpoint keeps or fails
 * .why = the same list drives the filter, the funnel, and each exclusion reason
 */
type PromiseCheck = {
  promise: string;
  keep: (endpoint: OpenRouterEndpoint) => boolean;
};

/**
 * .what = the checks implied by the slug's filters and the ask's params
 * .why = each filter word becomes one named check, in a fixed order
 */
const getAllPromiseChecks = (input: {
  filters: SupplyFilters;
  paramsRequired: string[];
  tagsJsonIgnored: string[];
}): PromiseCheck[] => {
  const { filters } = input;
  const checks: (PromiseCheck | null)[] = [
    input.paramsRequired.length
      ? {
          promise: `supports(${input.paramsRequired.join(',')})`,
          keep: (e) =>
            input.paramsRequired.every((p) =>
              e.supportedParameters.includes(p),
            ),
        }
      : null,
    input.tagsJsonIgnored.length
      ? {
          promise: 'honors(json) — not seen in prose, 7d',
          keep: (e) => !input.tagsJsonIgnored.includes(e.tag),
        }
      : null,
    filters.speedMinTps !== null
      ? {
          promise: `speed>=${filters.speedMinTps}tps`,
          keep: (e) =>
            e.throughputTps !== null &&
            e.throughputTps >= (filters.speedMinTps ?? 0),
        }
      : null,
    filters.precision !== null
      ? {
          promise: `precision=${filters.precision}`,
          keep: (e) => e.quantization === filters.precision,
        }
      : null,
    filters.privacy === 'full'
      ? {
          promise: 'privacy=full (zdr list)',
          keep: (e) => e.zdr,
        }
      : null,
    filters.region === 'usa'
      ? { promise: 'region=usa', keep: (e) => isUsaTag({ tag: e.tag }) }
      : null,
    filters.priceMaxUsdPerMillion !== null
      ? {
          promise: `price.max=${filters.priceMaxUsdPerMillion}usd/M`,
          keep: (e) =>
            e.pricePromptUsdPerToken * 1e6 <=
              (filters.priceMaxUsdPerMillion ?? 0) &&
            e.priceCompletionUsdPerToken * 1e6 <=
              (filters.priceMaxUsdPerMillion ?? 0),
        }
      : null,
  ];
  return checks.filter((check): check is PromiseCheck => check !== null);
};

/**
 * .what = each endpoint graded and ranked: its input estimate, and the first promise it fails
 * .why = the floor walks this list cheapest-first; among equal cost, fastest
 *        first (F3). `failed` is null for an endpoint that keeps every promise
 */
const getAllRankedVerdicts = (input: {
  endpoints: OpenRouterEndpoint[];
  checks: PromiseCheck[];
  tokens: { input: number };
}): { endpoint: OpenRouterEndpoint; estUsd: number; failed: string | null }[] =>
  input.endpoints
    .map((endpoint) => ({
      endpoint,
      estUsd: getOneEndpointCostEstimate({ endpoint, tokens: input.tokens }),
      failed:
        input.checks.find((check) => !check.keep(endpoint))?.promise ?? null,
    }))
    .sort(
      (a, b) =>
        asSortableCost(a.estUsd) - asSortableCost(b.estUsd) ||
        (b.endpoint.throughputTps ?? 0) - (a.endpoint.throughputTps ?? 0),
    );

/**
 * .what = how many endpoints survive each promise, applied in turn
 * .why = the funnel shows each promise's toll, so a refusal names the step
 *        that emptied the set
 */
const getAllFunnelSteps = (input: {
  endpoints: OpenRouterEndpoint[];
  checks: PromiseCheck[];
}): { promise: string; left: number }[] => {
  // the endpoints that keep every promise up to and with this one
  const getAllKeptThrough = (checkAt: number): OpenRouterEndpoint[] =>
    input.endpoints.filter((endpoint) =>
      input.checks.slice(0, checkAt + 1).every((check) => check.keep(endpoint)),
    );
  return [
    { promise: 'all endpoints', left: input.endpoints.length },
    ...input.checks.map((check, checkAt) => ({
      promise: check.promise,
      left: getAllKeptThrough(checkAt).length,
    })),
  ];
};

/**
 * .what = the fix line for an empty funnel, named for the step that emptied it
 * .why = a schema step is fixed in the ask (a z.string() reply), not the slug;
 *        a filter step is fixed in the slug
 */
const getOneEmptyFunnelFix = (input: {
  funnel: { promise: string; left: number }[];
}): string => {
  const stepEmptied = input.funnel.find((f) => f.left === 0)?.promise ?? '';
  if (stepEmptied.includes('response_format'))
    return 'fix: no endpoint honors a json schema. ask for a z.string() reply, or choose another model';
  if (stepEmptied.startsWith('honors(json)'))
    return 'fix: every json-capable endpoint answered prose on this machine within 7 days. ask for a z.string() reply, or choose another model';
  if (stepEmptied.startsWith('supports('))
    return `fix: no endpoint ${stepEmptied}. drop that param from the ask, or choose another model`;
  return 'fix: drop or loosen the promise where the count reaches 0';
};

/**
 * .what = one row of the refusal table: an endpoint, its input rate, the promise it fails
 * .why = case=4 owes the caller each endpoint and why it lost, cheapest first,
 *        so the cheapest rate on offer is the first row
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
 * .what = the qualified endpoints, cheapest-first for this ask, plus why
 * .why = a filtered ask may only admit endpoints in this set; the
 *        funnel and per-endpoint verdicts let the caller see why each lost
 *
 * .note = an empty set is refused with the funnel — each promise and how many
 *         endpoints it left — so the caller sees which promise emptied it
 */
export const getAllQualifiedEndpoints = (input: {
  model: string;
  endpoints: OpenRouterEndpoint[];
  filters: SupplyFilters;
  paramsRequired: string[];
  tagsJsonIgnored: string[]; // hosts this machine saw answer prose where json was owed
  tokens: { input: number };
}): {
  qualified: OpenRouterEndpoint[];
  funnel: { promise: string; left: number }[];
  verdicts: {
    endpoint: OpenRouterEndpoint;
    estUsd: number;
    failed: string | null;
  }[];
} => {
  const checks = getAllPromiseChecks(input);

  // grade and rank each endpoint; count how many survive each promise
  const verdicts = getAllRankedVerdicts({
    endpoints: input.endpoints,
    checks,
    tokens: input.tokens,
  });
  const funnel = getAllFunnelSteps({ endpoints: input.endpoints, checks });
  const qualified = verdicts
    .filter((v) => v.failed === null)
    .map((v) => v.endpoint);

  // refuse an empty set, with the step that emptied it
  if (qualified.length === 0)
    throw new ConstraintError(
      [
        `no endpoint of ${input.model} keeps every promise. no call was sent.`,
        '',
        ...funnel.map((f) => `  ${String(f.left).padStart(3)} ← ${f.promise}`),
        '',
        'each endpoint, cheapest input rate first, and the promise it fails:',
        ...verdicts.map(asVerdictRow),
        '',
        getOneEmptyFunnelFix({ funnel }),
      ].join('\n'),
      { model: input.model, filters: input.filters },
    );

  return { qualified, funnel, verdicts };
};
