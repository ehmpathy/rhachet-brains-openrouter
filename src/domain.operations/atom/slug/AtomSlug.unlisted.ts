import { asIsoPrice, priceDivide } from 'iso-price';
import { BrainSpec } from 'rhachet/brains';

/**
 * .what = a slug that names any openrouter model, by openrouter's own id
 * .why = openrouter lists hundreds of models and adds more each week; a caller
 *        reaches a new one with no release of this package (case=20)
 *
 * .shape = `openrouter/{author}/{model}`, plus the optional filter segment
 *
 * .note = the id is checked against openrouter's catalog at ask time, before
 *         any spend. a typo is refused there, with the nearest ids it lists
 * .note = the type is the loose `openrouter/${string}`, so a caller can build
 *         the slug from a runtime id; the exact shape is checked at build
 */
export type BrainAtomSlugOpenRouterUnlisted = `openrouter/${string}`;

/**
 * .what = openrouter's model id behind an unlisted base slug, or null
 * .why = an unlisted base must have exactly the `openrouter/{author}/{model}`
 *        shape; any other shape names no model openrouter could serve
 *
 * .example
 *   asUnlistedModelId({ base: 'openrouter/acme/new-model' })  // 'acme/new-model'
 *   asUnlistedModelId({ base: 'openrouter/acme' })            // null
 *   asUnlistedModelId({ base: 'anthropic/acme/new-model' })   // null
 */
export const asUnlistedModelId = (input: { base: string }): string | null => {
  const [repo, author, model, ...rest] = input.base.split('/');
  if (repo !== 'openrouter') return null;
  if (!author || !model || rest.length > 0) return null;
  return `${author}/${model}`;
};

/**
 * .what = the spec an unlisted atom carries, an ESTIMATE
 * .why = rhachet builds an atom synchronously, before any catalog read, so the
 *        real rate of an unlisted model cannot be known at build. the estimate
 *        leans high, so a budget check overstates the cost rather than under
 *
 * .note = the real charge rides back on each response as `usage.cost`, and
 *         lands in `metrics.cost.cash.total`. every atom built from this spec
 *         says "estimate" in its description
 * .note = `cutoff` is an upper bound: the date this estimate was set
 */
export const SPEC_ESTIMATE_UNLISTED = new BrainSpec({
  cost: {
    time: {
      speed: { tokens: 50, per: { seconds: 1 } },
      latency: { seconds: 1.5 },
    },
    cash: {
      per: 'token',
      cache: {
        get: priceDivide({ of: '$3.00', by: 1_000_000 }),
        set: asIsoPrice('$0'),
      },
      input: priceDivide({ of: '$3.00', by: 1_000_000 }),
      output: priceDivide({ of: '$15.00', by: 1_000_000 }),
    },
  },
  gain: {
    size: { context: { tokens: 128_000 } },
    grades: {},
    cutoff: '2026-10-02',
    domain: 'ALL',
    skills: { tooluse: true },
  },
});
