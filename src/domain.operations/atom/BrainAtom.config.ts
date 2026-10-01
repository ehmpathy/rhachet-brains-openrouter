import { asIsoPrice, dividePrice } from 'iso-price';
import { BrainSpec, type BrainSuppliesCreds } from 'rhachet/brains';

/**
 * .what = atom config type
 * .why = shared type for model configs
 */
export type BrainAtomConfig = {
  model: string;
  description: string;
  spec: BrainSpec;
};

/**
 * .what = credential keys required by fireworks ai
 * .why = enables type-safe credential lookup via rhachet's BrainSuppliesCreds
 */
export type CredsFireworks = { FIREWORKS_API_KEY: string };

/**
 * .what = supplies for fireworks brain supplier
 * .why = enables credential injection via keyrack shorthand or explicit getter
 *
 * .patterns:
 *   - keyrack shorthand: { keyrack: { owner: 'ehmpath', env: 'prod' } }
 *   - explicit getter: () => Promise<{ FIREWORKS_API_KEY: string }>
 */
export type BrainSuppliesFireworks = {
  creds: BrainSuppliesCreds<CredsFireworks>;
};

/**
 * .what = version-pinned fireworks ai atom slugs — the CANONICAL names
 * .why = enables a caller to pin an exact model version, so a provider's
 *        version churn cannot move the weights under them
 *
 * .shape = `fireworks/{family}/{tier}/{version}`
 *
 *         the tier is its own segment, so a pin and its generic are peers that
 *         differ by one word:
 *
 *           fireworks/deepseek/flash/v4.1     <- this exact version
 *           fireworks/deepseek/flash/latest   <- whichever version is current
 *
 *         it also lets tier tell two models apart where a suffix used to:
 *         `glm/pro/5.3` and `glm/flash/5.3` are one release in two tiers.
 *
 * .note = this union is the CANONICAL set, never the ACCEPTED set. a caller may
 *         also name a versionless or a pre-tier slug, and `slug/AtomSlug.ts`
 *         is the root that maps all three forms — read it first.
 *
 * .note = every slug below was verified by a LIVE chat completion on
 *         2026-09-22. a catalog read is not evidence of serve-ability — three
 *         ids that the catalog returned as available answered 404 on
 *         inference on 2026-09-16. only a real call proves a model serves.
 *
 * .note = slugs dropped on 2026-09-16, each for a live 404:
 *         - `fireworks/qwen/3.7-plus`   — `qwen3p7-plus` 404s; catalog lists it
 *         - `fireworks/minimax/2.7`     — `minimax-m2p7` 404s; catalog lists it
 *         - `fireworks/gpt-oss/20b`     — `gpt-oss-20b` 404s; absent from catalog
 *
 * .note = `fireworks/glm/5.1` was dropped earlier: pay-per-token for GLM-5.1 was
 *         deprecated effective 2026-08-07, so its id 404s on serverless. it
 *         remains on provisioned throughput only, which this package does not
 *         target. a deprecation is never fixable by a re-pin.
 *
 * .note = five of these carry a retirement (`RETIREMENT_BY_ATOM_SLUG`). they
 *         stay in this union and keep their config, because a live probe on
 *         2026-09-22 found that every one of them still serves. a retirement is
 *         an ANNOUNCEMENT, and to drop a slug on the announcement would break a
 *         caller whose model still answers.
 */
export type BrainAtomSlugFireworksPinned =
  // deepseek
  | 'fireworks/deepseek/pro/v4'
  | 'fireworks/deepseek/flash/v4.1'
  | 'fireworks/deepseek/flash/v4'
  // moonshot/kimi
  | 'fireworks/kimi/pro/k3'
  | 'fireworks/kimi/code/k2.7'
  | 'fireworks/kimi/pro/k2.6'
  // z.ai/glm
  | 'fireworks/glm/pro/5.3'
  | 'fireworks/glm/flash/5.3'
  | 'fireworks/glm/pro/5.2'
  // minimax
  | 'fireworks/minimax/flash/m3'
  // fireworks/gpt-oss
  | 'fireworks/gpt-oss/flash/120b'
  // nvidia/nemotron
  | 'fireworks/nemotron/flash/3.5';

/**
 * .what = model configuration by slug
 * .why = maps slugs to api model names, descriptions, and specs
 *
 * .note = on `cache.get` — fireworks bills a cached prompt token at a REDUCED,
 *         per-model rate, never at zero. the discount is not uniform: it spans
 *         ~3% of the input rate (deepseek flash) to ~20% (kimi-k2.7-code,
 *         minimax-m3). so each model carries its own cited figure, and a `$0`
 *         here would be a placeholder, not a measurement.
 *
 * .note = on `cache.set` — fireworks publishes NO cache-write rate and its rate
 *         table holds no write column; a prompt cache fills as a side effect of
 *         the read path. so `set: $0` is verified, not a placeholder.
 *         `tokens.cache.set` stays 0 for the same reason: the api returns no
 *         write count to bill.
 *
 * .note = rates below are the STANDARD tier, which is what a plain serverless
 *         call receives. the Priority and Fast tiers cost more, and this
 *         package requests neither.
 *
 * .note = `context.tokens` is the exact `context_length` the models api
 *         reports, never a rounded vendor-page figure. so 1_048_576 rather
 *         than "1M", 262_144 rather than "256K".
 *
 * .note = `cost.time` values are ESTIMATES, not measurements. they order the
 *         models by rough throughput; they are not benchmarks.
 *
 * .note = `gain.cutoff` holds the fireworks deploy date, which is an UPPER
 *         bound on the model's knowledge cutoff. the true cutoff is
 *         unpublished for every model here, and a guess would read as a fact.
 *
 * .sources:
 *   - rates: https://docs.fireworks.ai/serverless/pricing (read 2026-09-16)
 *   - prompt cache: https://docs.fireworks.ai/guides/prompt-caching
 *   - models: https://api.fireworks.ai/inference/v1/models (read 2026-09-16)
 *   - api docs: https://docs.fireworks.ai/reference/chat-completions-1
 *   - benchmarks: https://benchlm.ai/benchmarks/sweVerified
 */
export const CONFIG_BY_ATOM_SLUG: Record<
  BrainAtomSlugFireworksPinned,
  BrainAtomConfig
> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // deepseek
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * deepseek-v4-pro — frontier capacity
   *
   * .note = the `-0813` suffix is required. verified 2026-09-16: the catalog
   *         returns BOTH `deepseek-v4-pro` and `deepseek-v4-pro-0813`, yet only
   *         the dated id answers a chat completion; the un-suffixed id 404s.
   *         the catalog is not evidence of serve-ability, only a live call is.
   *
   * .sources:
   *   - rates: $1.32/1M input, $0.044/1M cached input, $3.96/1M output
   *   - context: 1_048_576 (models api)
   *   - deployed: 2026-08-13 (models api)
   *   - swe-bench verified: 80.6%
   *   - mmlu-pro: 87.5%
   *   - gpqa-diamond: 90.1%
   */
  'fireworks/deepseek/pro/v4': {
    model: 'accounts/fireworks/models/deepseek-v4-pro-0813',
    description: 'deepseek-v4-pro - frontier (1M, swe 80.6%)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 80, per: { seconds: 1 } },
          latency: { seconds: 1.2 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.044', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$1.32', by: 1_000_000 }),
          output: dividePrice({ of: '$3.96', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 1_048_576 } },
        grades: { swe: 80.6, mmlu: 87.5, gpqa: 90.1 },
        cutoff: '2026-08-13',
        domain: 'ALL',
        skills: { tooluse: true },
      },
    }),
  },
  /**
   * deepseek-v4.1-flash — cheapfast, with vision
   *
   * .note = same rates and same context as v4-flash. what it adds is image
   *         input (`supports_image_input: true`) and a later deploy date.
   *         fireworks publishes no benchmark for it, so `grades` stays empty
   *         rather than inherit v4-flash's numbers.
   *
   * .sources:
   *   - rates: $0.22/1M input, $0.007/1M cached input, $0.66/1M output
   *   - context: 1_048_576 (models api)
   *   - deployed: 2026-09-09 (models api)
   */
  'fireworks/deepseek/flash/v4.1': {
    model: 'accounts/fireworks/models/deepseek-v4p1-flash',
    description: 'deepseek-v4.1-flash - cheapfast vision (1M)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 150, per: { seconds: 1 } },
          latency: { seconds: 0.4 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.007', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.22', by: 1_000_000 }),
          output: dividePrice({ of: '$0.66', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 1_048_576 } },
        grades: {},
        cutoff: '2026-09-09',
        domain: 'ALL',
        skills: { tooluse: true, vision: true },
      },
    }),
  },
  /**
   * deepseek-v4-flash — cheapfast
   *
   * .note = the `-0731` suffix is required. verified 2026-08-14 and again
   *         2026-09-16: the un-suffixed
   *         `accounts/fireworks/models/deepseek-v4-flash` returns 404
   *         NOT_FOUND, while the `-0731` id serves. do not "tidy" the suffix
   *         away. a catalog page may still list the un-suffixed id as
   *         available; the api is authoritative over the catalog.
   *
   * .sources:
   *   - model: https://fireworks.ai/models/deepseek-ai/deepseek-v4-flash-0731
   *   - rates: $0.22/1M input, $0.007/1M cached input, $0.66/1M output
   *   - context: 1_048_576 (models api)
   *   - deployed: 2026-08-01 (models api)
   *   - swe-bench verified: 79.0%
   *   - gpqa-diamond: ~88%
   */
  'fireworks/deepseek/flash/v4': {
    model: 'accounts/fireworks/models/deepseek-v4-flash-0731',
    description: 'deepseek-v4-flash - cheapfast (1M, swe 79.0%)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 150, per: { seconds: 1 } },
          latency: { seconds: 0.4 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.007', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.22', by: 1_000_000 }),
          output: dividePrice({ of: '$0.66', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 1_048_576 } },
        grades: { swe: 79.0, gpqa: 88 },
        cutoff: '2026-08-01',
        domain: 'ALL',
        skills: { tooluse: true },
      },
    }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // moonshot/kimi
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * kimi-k3 — frontier, vision, 1M context
   *
   * .note = the most expensive model in this catalog by a wide margin:
   *         $3.00/1M input against $1.40 for the next. reach for it only when
   *         a task genuinely needs its capacity.
   *
   * .sources:
   *   - rates: $3.00/1M input, $0.30/1M cached input, $15.00/1M output
   *   - context: 1_048_576 (models api)
   *   - deployed: 2026-07-19 (models api)
   */
  'fireworks/kimi/pro/k3': {
    model: 'accounts/fireworks/models/kimi-k3',
    description: 'kimi-k3 - frontier vision (1M)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 70, per: { seconds: 1 } },
          latency: { seconds: 1.5 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.30', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$3.00', by: 1_000_000 }),
          output: dividePrice({ of: '$15.00', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 1_048_576 } },
        grades: {},
        cutoff: '2026-07-19',
        domain: 'ALL',
        skills: { tooluse: true, vision: true },
      },
    }),
  },
  /**
   * kimi-k2.7-code — agentic code, 30% fewer tokens than k2.6
   * .sources:
   *   - blog: https://fireworks.ai/blog/kimi-k2p7-code
   *   - rates: $0.95/1M input, $0.19/1M cached input, $4.00/1M output
   *   - context: 262_144 (models api)
   *   - deployed: 2026-07-30 (models api)
   */
  'fireworks/kimi/code/k2.7': {
    model: 'accounts/fireworks/models/kimi-k2p7-code',
    description: 'kimi-k2.7-code - agentic code (256K)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 90, per: { seconds: 1 } },
          latency: { seconds: 1 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.19', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.95', by: 1_000_000 }),
          output: dividePrice({ of: '$4.00', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 262_144 } },
        grades: {},
        cutoff: '2026-07-30',
        domain: 'SOFTWARE',
        skills: { tooluse: true, vision: true },
      },
    }),
  },
  /**
   * kimi-k2.6 — strong swe-bench
   *
   * .note = context was declared as 128_000 until 2026-09-16, when the models
   *         api reported 262_144. the declared figure was wrong by half, which
   *         would have truncated a caller's budget for no reason.
   *
   * .sources:
   *   - rates: $0.95/1M input, $0.16/1M cached input, $4.00/1M output
   *   - context: 262_144 (models api)
   *   - deployed: 2026-06-18 (models api)
   *   - swe-bench verified: 80.2%
   */
  'fireworks/kimi/pro/k2.6': {
    model: 'accounts/fireworks/models/kimi-k2p6',
    description: 'kimi-k2.6 - frontier (256K, swe 80.2%)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 90, per: { seconds: 1 } },
          latency: { seconds: 1 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.16', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.95', by: 1_000_000 }),
          output: dividePrice({ of: '$4.00', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 262_144 } },
        grades: { swe: 80.2 },
        cutoff: '2026-06-18',
        domain: 'ALL',
        skills: { tooluse: true, vision: true },
      },
    }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // z.ai/glm
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * glm-5.3 — frontier code, successor to 5.2
   *
   * .note = the cached-input rate is HIGHER than 5.2's ($0.26 against $0.14)
   *         at the same input rate, so a cache-heavy workload can cost more on
   *         5.3 than on 5.2. that is counterintuitive, hence the note.
   *
   * .sources:
   *   - rates: $1.40/1M input, $0.26/1M cached input, $4.40/1M output
   *   - context: 1_048_576 (models api)
   *   - deployed: 2026-08-27 (models api)
   */
  'fireworks/glm/pro/5.3': {
    model: 'accounts/fireworks/models/glm-5p3',
    description: 'glm-5.3 - frontier code (1M)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 80, per: { seconds: 1 } },
          latency: { seconds: 1 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.26', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$1.40', by: 1_000_000 }),
          output: dividePrice({ of: '$4.40', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 1_048_576 } },
        grades: {},
        cutoff: '2026-08-27',
        domain: 'ALL',
        skills: { tooluse: true },
      },
    }),
  },
  /**
   * glm-5.3-flash — cheapfast, vision, 1M context
   *
   * .note = the cheapest 1M-context model here that also takes images. at
   *         $0.15/1M input it undercuts every peer with that context size.
   *
   * .sources:
   *   - rates: $0.15/1M input, $0.03/1M cached input, $0.50/1M output
   *   - context: 1_048_576 (models api)
   *   - deployed: 2026-08-25 (models api)
   */
  'fireworks/glm/flash/5.3': {
    model: 'accounts/fireworks/models/glm-5p3-flash',
    description: 'glm-5.3-flash - cheapfast vision (1M)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 160, per: { seconds: 1 } },
          latency: { seconds: 0.4 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.03', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.15', by: 1_000_000 }),
          output: dividePrice({ of: '$0.50', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 1_048_576 } },
        grades: {},
        cutoff: '2026-08-25',
        domain: 'ALL',
        skills: { tooluse: true, vision: true },
      },
    }),
  },
  /**
   * glm-5.2 — strongest open-source code
   * .sources:
   *   - blog: https://fireworks.ai/blog/glm-5p2
   *   - rates: $1.40/1M input, $0.14/1M cached input, $4.40/1M output
   *   - context: 1_048_576 (models api)
   *   - deployed: 2026-07-08 (models api)
   *   - swe-bench verified: 77.8%
   *   - swe-bench pro: 62.1%
   *   - gpqa-diamond: 92.9%
   *   - terminal-bench 2.1: 81.0
   */
  'fireworks/glm/pro/5.2': {
    model: 'accounts/fireworks/models/glm-5p2',
    description: 'glm-5.2 - frontier code (1M, swe 77.8%, gpqa 92.9%)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 80, per: { seconds: 1 } },
          latency: { seconds: 1 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.14', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$1.40', by: 1_000_000 }),
          output: dividePrice({ of: '$4.40', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 1_048_576 } },
        grades: { swe: 77.8, gpqa: 92.9 },
        cutoff: '2026-07-08',
        domain: 'ALL',
        skills: { tooluse: true },
      },
    }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // minimax
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * minimax-m3 — long context + native multimodal at 1/20th price
   * .sources:
   *   - blog: https://fireworks.ai/blog/minimax-m3-launch
   *   - rates: $0.30/1M input, $0.06/1M cached input, $1.20/1M output
   *   - context: 512_000 (models api)
   *   - deployed: 2026-07-02 (models api)
   *   - swe-bench verified: 80.5%
   */
  'fireworks/minimax/flash/m3': {
    model: 'accounts/fireworks/models/minimax-m3',
    description: 'minimax-m3 - cheapfast multimodal (500K, swe 80.5%)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 140, per: { seconds: 1 } },
          latency: { seconds: 0.5 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.06', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.30', by: 1_000_000 }),
          output: dividePrice({ of: '$1.20', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 512_000 } },
        grades: { swe: 80.5 },
        cutoff: '2026-07-02',
        domain: 'ALL',
        skills: { tooluse: true },
      },
    }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // fireworks/gpt-oss
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * gpt-oss-120b
   * .sources:
   *   - rates: $0.15/1M input, $0.015/1M cached input, $0.60/1M output
   *   - context: 131_072 (models api)
   *   - deployed: 2026-05-05 (models api)
   */
  'fireworks/gpt-oss/flash/120b': {
    model: 'accounts/fireworks/models/gpt-oss-120b',
    description: 'gpt-oss-120b - cheapfast (128K)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 120, per: { seconds: 1 } },
          latency: { seconds: 0.5 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.015', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.15', by: 1_000_000 }),
          output: dividePrice({ of: '$0.60', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 131_072 } },
        grades: {},
        cutoff: '2026-05-05',
        domain: 'ALL',
        skills: { tooluse: true },
      },
    }),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // nvidia/nemotron
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * nemotron 3.5 lightning 30b-a3b — the cheapest model in this catalog
   *
   * .note = a 30b mixture-of-experts with 3b active, so it is cheap and quick
   *         but well below the frontier tier on capacity. reach for it on
   *         high-volume, low-difficulty work.
   *
   * .sources:
   *   - rates: $0.05/1M input, $0.01/1M cached input, $0.20/1M output
   *   - context: 262_144 (models api)
   *   - deployed: 2026-08-07 (models api)
   */
  'fireworks/nemotron/flash/3.5': {
    model: 'accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b',
    description: 'nemotron-3.5-lightning - cheapest (256K)',
    spec: new BrainSpec({
      cost: {
        time: {
          speed: { tokens: 220, per: { seconds: 1 } },
          latency: { seconds: 0.3 },
        },
        cash: {
          per: 'token',
          cache: {
            get: dividePrice({ of: '$0.01', by: 1_000_000 }),
            set: asIsoPrice('$0'),
          },
          input: dividePrice({ of: '$0.05', by: 1_000_000 }),
          output: dividePrice({ of: '$0.20', by: 1_000_000 }),
        },
      },
      gain: {
        size: { context: { tokens: 262_144 } },
        grades: {},
        cutoff: '2026-08-07',
        domain: 'ALL',
        skills: { tooluse: true },
      },
    }),
  },
};
