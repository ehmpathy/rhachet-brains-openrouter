import { asIsoPrice, priceDivide } from 'iso-price';
import { BrainSpec, type BrainSuppliesCreds } from 'rhachet/brains';

/**
 * .what = credential keys required by openrouter
 * .why = enables type-safe credential lookup via rhachet's BrainSuppliesCreds
 */
export type CredsOpenRouter = { OPENROUTER_API_KEY: string };

/**
 * .what = supplies for the openrouter brain supplier
 * .why = enables credential injection via keyrack shorthand or explicit getter
 *
 * .patterns:
 *   - keyrack shorthand: { keyrack: { owner: 'ehmpath', env: 'prod' } }
 *   - explicit getter: () => Promise<{ OPENROUTER_API_KEY: string }>
 */
export type BrainSuppliesOpenRouter = {
  creds: BrainSuppliesCreds<CredsOpenRouter>;
};

/**
 * .what = the spec each tier's atom carries, an ESTIMATE per tier
 * .why = rhachet builds an atom synchronously, before any catalog read, and a
 *        tier's model is only known at ask. so the spec describes the tier,
 *        never one model, and no model id or version lives in this file
 *
 * .note = rates lean HIGH, so a budget check overstates the cost rather than
 *         under. the real charge rides back on each response as `usage.cost`,
 *         and lands in `metrics.cost.cash.total`
 * .note = context is the pick's window, rounded down to a grain (1M, 250K,
 *         200K). hosts differ by a few percent (1_000_000 to 1_048_576 on
 *         deepseek v4.1-flash, read 2026-10-03), so the grain fits every host.
 *         ci checks it against the live pick
 * .note = speed is the floor the default supply filters demand (≥ 50 tps)
 * .note = `cutoff` is an upper bound: the date these estimates were set
 */
export const SPEC_ESTIMATE_BY_TIER: Record<'pro' | 'flash', BrainSpec> = {
  pro: new BrainSpec({
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
      size: { context: { tokens: 1_000_000 } },
      grades: {},
      cutoff: '2026-10-02',
      domain: 'ALL',
      skills: { tooluse: true },
    },
  }),
  flash: new BrainSpec({
    cost: {
      time: {
        speed: { tokens: 50, per: { seconds: 1 } },
        latency: { seconds: 0.6 },
      },
      cash: {
        per: 'token',
        cache: {
          get: priceDivide({ of: '$0.30', by: 1_000_000 }),
          set: asIsoPrice('$0'),
        },
        input: priceDivide({ of: '$0.30', by: 1_000_000 }),
        output: priceDivide({ of: '$2.00', by: 1_000_000 }),
      },
    },
    gain: {
      size: { context: { tokens: 1_000_000 } },
      grades: {},
      cutoff: '2026-10-02',
      domain: 'ALL',
      skills: { tooluse: true },
    },
  }),
};
