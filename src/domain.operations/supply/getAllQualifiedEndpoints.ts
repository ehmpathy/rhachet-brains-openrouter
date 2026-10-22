import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplySort } from '../../domain.objects/SupplySort';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneNoQualifiedEndpointError } from './getOneNoQualifiedEndpointError';

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
 * .what = one promise, as a check an endpoint keeps or fails, with the fix where it empties the set
 * .why = the same list drives the filter, the funnel, each exclusion reason, and the
 *        refusal's fix line, so a fix can never drift from the step it names
 */
type PromiseCheck = {
  promise: string;
  keep: (endpoint: OpenRouterEndpoint) => boolean;
  fix: string;
};

// the fix where no host survives a filter word of the slug
const FIX_FILTER = 'fix: drop or loosen the promise where the count reaches 0';

/**
 * .what = the fix line where no host lists one param the ask needs
 * .why = a schema param is fixed in the ask (a z.string() reply), a reasoning param by
 *        a drop of the effort, any other param by a drop of that param
 */
const asParamFix = (input: { param: string }): string => {
  if (input.param === 'response_format' || input.param === 'structured_outputs')
    return 'fix: no endpoint honors a json schema. ask for a z.string() reply, or choose another model';
  if (input.param === 'reasoning')
    return 'fix: no endpoint supports(reasoning). drop the effort from the ask, or choose a model whose hosts list reasoning';
  return `fix: no endpoint supports(${input.param}). drop that param from the ask, or choose another model`;
};

/**
 * .what = the fix line where a thought budget fills every host's output limit
 * .why = the fix must name the number to go below, never leave the caller to guess it
 *
 * .note = the number comes from the hosts that list every param the ask needs: the thought
 *         step runs after the param steps, so a host that lacks a param could never serve
 */
const asThoughtBudgetFix = (input: {
  endpoints: OpenRouterEndpoint[];
  paramsRequired: string[];
}): string => {
  const limits = input.endpoints
    .filter((endpoint) =>
      input.paramsRequired.every((param) =>
        endpoint.supportedParameters.includes(param),
      ),
    )
    .map((endpoint) => endpoint.maxCompletionTokens)
    .filter((limit): limit is number => limit !== null);
  if (limits.length === 0)
    return "fix: lower effort.budget.tokens below the hosts' output limit, so the answer has room";
  return `fix: lower effort.budget.tokens below ${Math.max(...limits).toLocaleString('en-US')}, the largest output limit a host lists, so the answer has room`;
};

/**
 * .what = the checks implied by the slug's filters and the ask's params
 * .why = each filter word becomes one named check, in a fixed order
 */
const getAllPromiseChecks = (input: {
  endpoints: OpenRouterEndpoint[];
  filters: SupplyFilters;
  paramsRequired: string[];
  tagsJsonIgnored: string[];
  tokensThoughtBudget: number | null;
}): PromiseCheck[] => {
  const { filters } = input;
  // .note = one check per param, so the step that empties the funnel names the one param no host lists
  const checks: (PromiseCheck | null)[] = [
    ...input.paramsRequired.map((param) => ({
      promise: `supports(${param})`,
      keep: (e: OpenRouterEndpoint) => e.supportedParameters.includes(param),
      fix: asParamFix({ param }),
    })),
    input.tokensThoughtBudget !== null
      ? {
          // .why = a budget at or past the host's output limit leaves no room to answer (q6)
          promise: `thought<output.max (budget ${input.tokensThoughtBudget.toLocaleString('en-US')} tokens)`,
          keep: (e) =>
            e.maxCompletionTokens === null ||
            (input.tokensThoughtBudget ?? 0) < e.maxCompletionTokens,
          fix: asThoughtBudgetFix({
            endpoints: input.endpoints,
            paramsRequired: input.paramsRequired,
          }),
        }
      : null,
    input.tagsJsonIgnored.length
      ? {
          promise: 'honors(json) — no prose or 0-char reply seen, 7d',
          keep: (e) => !input.tagsJsonIgnored.includes(e.tag),
          fix: 'fix: every json-capable endpoint answered prose or 0 chars on this machine within 7 days. ask for a z.string() reply, or choose another model',
        }
      : null,
    filters.speedMinTps !== null
      ? {
          promise: `speed>=${filters.speedMinTps}tps`,
          keep: (e) =>
            e.throughputTps !== null &&
            e.throughputTps >= (filters.speedMinTps ?? 0),
          fix: FIX_FILTER,
        }
      : null,
    filters.precision !== null
      ? {
          promise: `precision=${filters.precision}`,
          keep: (e) => e.quantization === filters.precision,
          fix: FIX_FILTER,
        }
      : null,
    filters.privacy === 'full'
      ? {
          promise: 'privacy=full (zdr list)',
          keep: (e) => e.zdr,
          fix: FIX_FILTER,
        }
      : null,
    filters.region === 'usa'
      ? {
          promise: 'region=usa',
          keep: (e) => isUsaTag({ tag: e.tag }),
          fix: FIX_FILTER,
        }
      : null,
    filters.priceMaxUsdPerMillion !== null
      ? {
          promise: `price.max=${filters.priceMaxUsdPerMillion}usd/M`,
          keep: (e) =>
            e.pricePromptUsdPerToken * 1e6 <=
              (filters.priceMaxUsdPerMillion ?? 0) &&
            e.priceCompletionUsdPerToken * 1e6 <=
              (filters.priceMaxUsdPerMillion ?? 0),
          fix: FIX_FILTER,
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
  sort: SupplySort | null;
}): { endpoint: OpenRouterEndpoint; estUsd: number; failed: string | null }[] =>
  input.endpoints
    .map((endpoint) => ({
      endpoint,
      estUsd: getOneEndpointCostEstimate({ endpoint, tokens: input.tokens }),
      failed:
        input.checks.find((check) => !check.keep(endpoint))?.promise ?? null,
    }))
    .sort(asVerdictComparator({ sort: input.sort }));

/**
 * .what = the order verdicts rank in, per the slug's sort word
 * .why = `sort=throughput` tries the fastest qualified host first; every other
 *        sort, and none, keeps the floor's order: cheapest input first, then fastest
 *
 * .note = `latency` reaches here only without floor, where openrouter orders the
 *         admitted set itself; the local rank then only shapes the report
 *
 * .note = binary `(a, b)` by necessity: it is the comparator `Array.prototype.sort` calls
 */
const asVerdictComparator =
  (input: { sort: SupplySort | null }) =>
  (
    a: { endpoint: OpenRouterEndpoint; estUsd: number },
    b: { endpoint: OpenRouterEndpoint; estUsd: number },
  ): number => {
    const byCost = asSortableCost(a.estUsd) - asSortableCost(b.estUsd);
    const bySpeed =
      (b.endpoint.throughputTps ?? 0) - (a.endpoint.throughputTps ?? 0);
    if (input.sort === 'throughput') return bySpeed || byCost;
    return byCost || bySpeed;
  };

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
 * .what = the fix line for an empty funnel: the fix of the check that emptied it
 * .why = each check carries its own fix, so no label is parsed back into a cause
 */
const getOneEmptyFunnelFix = (input: {
  checks: PromiseCheck[];
  funnel: { left: number }[];
}): string => {
  // funnel row 0 is "all endpoints"; row n+1 is check n
  const rowEmptied = input.funnel.findIndex((f) => f.left === 0);
  return input.checks[rowEmptied - 1]?.fix ?? FIX_FILTER;
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
  tokensThoughtBudget: number | null; // the ask's effort.budget.tokens; null = no budget
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
    sort: input.filters.sort,
  });
  const funnel = getAllFunnelSteps({ endpoints: input.endpoints, checks });
  const qualified = verdicts
    .filter((v) => v.failed === null)
    .map((v) => v.endpoint);

  // refuse an empty set, with the step that emptied it
  if (qualified.length === 0)
    throw getOneNoQualifiedEndpointError({
      model: input.model,
      filters: input.filters,
      funnel,
      verdicts,
      fix: getOneEmptyFunnelFix({ checks, funnel }),
    });

  return { qualified, funnel, verdicts };
};
