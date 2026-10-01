# rhachet-brains-fireworksai

rhachet brain.atom adapter for fireworks ai open-source models

## install

```sh
npm install rhachet-brains-fireworksai
```

## usage

```ts
import { genBrainAtom } from 'rhachet-brains-fireworksai';
import { z } from 'zod';

// create a brain atom for direct model inference
const brainAtom = genBrainAtom({ slug: 'fireworks/deepseek/flash/latest' });

// simple string output
const { output: explanation } = await brainAtom.ask({
  role: { briefs: [] },
  prompt: 'explain this code',
  schema: { output: z.string() },
});

// structured object output
const { output: { summary, issues } } = await brainAtom.ask({
  role: { briefs: [] },
  prompt: 'analyze this code',
  schema: { output: z.object({ summary: z.string(), issues: z.array(z.string()) }) },
});
```

## available brains

slug shape: `fireworks/{family}/{tier}/{version|latest}`.

### versionless slugs — the recommended way to name a model

a provider retires model versions on its own clock. name a **versionless** slug and that
churn costs you naught: we re-aim it here, and your code never changes.

| slug | names today | tier |
| --- | --- | --- |
| `fireworks/deepseek/flash/latest` | DeepSeek-V4.1-Flash | cheapfast |
| `fireworks/deepseek/pro/latest` | DeepSeek-V4.1-Flash ⚠️ | see below |
| `fireworks/glm/flash/latest` | GLM-5.3-Flash | cheapfast |
| `fireworks/glm/pro/latest` | GLM-5.3 | frontier |
| `fireworks/kimi/pro/latest` | Kimi-K3 | frontier |
| `fireworks/minimax/flash/latest` | MiniMax-M3 | cheapfast |
| `fireworks/gpt-oss/flash/latest` | GPT-OSS-120B | cheapfast |
| `fireworks/nemotron/flash/latest` | Nemotron-3.5-Lightning | cheapfast |

**the tier is part of the name on purpose** — a bare `{family}/latest` would let a cheapfast
caller drift onto a frontier model at 6x the input rate with no signal. version is the axis
you do not care about; tier is the one you chose.

> **pin instead when you need byte-stable weights** — an eval, a snapshot suite, a
> reproducibility guarantee. every version-pinned slug below stays supported, forever. the
> versionless slug is a convenience, never a replacement.

#### ⚠️ one cross-tier exception: `fireworks/deepseek/pro/latest`

deepseek's pro tier is discontinued. fireworks named **V4.1-Flash** as V4-Pro's successor, so
the pro generic points at a **cheapfast** model — `$1.32` → `$0.22` input, swe-bench 80.6% →
unpublished. both deepseek generics name the same model while this stands.

if you need frontier capacity from deepseek, there is none today; reach for
`fireworks/kimi/pro/latest` or `fireworks/glm/pro/latest` instead. when deepseek ships a real
pro-tier model, this generic re-aims onto it and you change naught.

> note this is **not** the same call as the pinned `fireworks/deepseek/pro/v4`, which still
> refuses to route. when you name the exact model you chose that capacity, so we will not
> swap it under you. when you name the generic you asked us to choose. that delegation is the
> only difference, and it is the reason one routes and the other does not.

#### no generic for `fireworks/kimi/code`

kimi's code tier holds one model, and it is retired with two candidate successors that
fireworks did not choose between. a generic that named it would be a scheduled break under a
safe name, so the tier carries a pin and no generic.

### atoms (via genBrainAtom)

stateless inference with tool use support. **every model below answered a live chat completion
on 2026-09-22** — a catalog entry is not evidence that a model serves, so each id is probed
rather than assumed.

rates are the **standard** tier, per 1M tokens. `cached input` is what a prompt-cache hit costs
— see [prompt cache](#prompt-cache) for how to earn one.

#### pro tier — frontier

highest capability models for complex tasks.

| slug | model | context | vision | swe-bench | input | cached input | output |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fireworks/kimi/pro/k3` | Kimi-K3 | 1M | ✔ | — | $3.00 | $0.30 | $15.00 |
| `fireworks/deepseek/pro/v4` | DeepSeek-V4-Pro | 1M | — | 80.6% | $1.32 | $0.044 | $3.96 |
| `fireworks/kimi/pro/k2.6` | Kimi-K2.6 | 256K | ✔ | 80.2% | $0.95 | $0.16 | $4.00 |
| `fireworks/glm/pro/5.2` | GLM-5.2 | 1M | — | 77.8% | $1.40 | $0.14 | $4.40 |
| `fireworks/glm/pro/5.3` | GLM-5.3 | 1M | — | — | $1.40 | $0.26 | $4.40 |

#### flash tier — cheapfast

models optimized for high-volume inference at low cost.

| slug | model | context | vision | swe-bench | input | cached input | output |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fireworks/nemotron/flash/3.5` | Nemotron-3.5-Lightning-30B-A3B | 256K | — | — | $0.05 | $0.01 | $0.20 |
| `fireworks/gpt-oss/flash/120b` | GPT-OSS-120B | 128K | — | — | $0.15 | $0.015 | $0.60 |
| `fireworks/glm/flash/5.3` | GLM-5.3-Flash | 1M | ✔ | — | $0.15 | $0.03 | $0.50 |
| `fireworks/deepseek/flash/v4` | DeepSeek-V4-Flash | 1M | — | 79.0% | $0.22 | $0.007 | $0.66 |
| `fireworks/deepseek/flash/v4.1` | DeepSeek-V4.1-Flash | 1M | ✔ | — | $0.22 | $0.007 | $0.66 |
| `fireworks/minimax/flash/m3` | MiniMax-M3 | 500K | — | 80.5% | $0.30 | $0.06 | $1.20 |

#### code tier — code-specialized

| slug | model | context | vision | swe-bench | input | cached input | output |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fireworks/kimi/code/k2.7` | Kimi-K2.7-Code | 256K | ✔ | — | $0.95 | $0.19 | $4.00 |

> rates from [fireworks serverless rates](https://docs.fireworks.ai/serverless/rates) (read 2026-09-16).
> context and vision from the [models api](https://api.fireworks.ai/inference/v1/models) (read 2026-09-16);
> the table rounds, the spec carries the exact figure (e.g. `1_048_576`, not "1M").
> swe-bench verified scores from [benchlm](https://benchlm.ai/benchmarks/sweVerified) and fireworks ai model cards.
> a `—` under swe-bench means fireworks publishes no score; we do not guess one.

#### the pre-tier slug names still work

the tier used to be mashed into the version (`v4.1-flash`) or omitted (`k3`). every one of
those names is still accepted, as an alias, and reaches the same model it always did:

| you named | it reaches |
| --- | --- |
| `fireworks/deepseek/v4-pro` | `fireworks/deepseek/pro/v4` |
| `fireworks/deepseek/v4.1-flash` | `fireworks/deepseek/flash/v4.1` |
| `fireworks/deepseek/v4-flash` | `fireworks/deepseek/flash/v4` |
| `fireworks/kimi/k3` | `fireworks/kimi/pro/k3` |
| `fireworks/kimi/k2.7-code` | `fireworks/kimi/code/k2.7` |
| `fireworks/kimi/k2.6` | `fireworks/kimi/pro/k2.6` |
| `fireworks/glm/5.3` | `fireworks/glm/pro/5.3` |
| `fireworks/glm/5.3-flash` | `fireworks/glm/flash/5.3` |
| `fireworks/glm/5.2` | `fireworks/glm/pro/5.2` |
| `fireworks/minimax/m3` | `fireworks/minimax/flash/m3` |
| `fireworks/gpt-oss/120b` | `fireworks/gpt-oss/flash/120b` |
| `fireworks/nemotron/3.5-lightning` | `fireworks/nemotron/flash/3.5` |

> a rename is churn unless the old name survives. these are a contract we already shipped, so
> each still names what it always did. `asPinnedAtomSlug({ slug })` answers which model any
> name reaches.

#### retired

fireworks announced retirements for five of the models above. **your code still works** — you
need no edit today.

two had a single successor, so they are routed for you, silently:

| your slug | now reaches | what changes |
| --- | --- | --- |
| `fireworks/deepseek/flash/v4` | `fireworks/deepseek/flash/v4.1` | naught — same rates, same 1M context, and it gains vision |
| `fireworks/glm/pro/5.2` | `fireworks/glm/pro/5.3` | same input/output rates and context. ⚠️ cached input rises `$0.14` → `$0.26`, so a **cache-heavy** workload costs more |

three had **no single correct successor**, so they are *not* routed. a wrong alias is worse
than no alias, because it is silent — you would get different answers at a different price
and never learn why. these serve until fireworks withdraws them, and then fail with an error
that names your options:

| your slug | why no automatic route | choose from |
| --- | --- | --- |
| `fireworks/deepseek/pro/v4` | the only successor fireworks named is a tier drop (frontier → cheapfast, `$1.32` → `$0.22`, swe 80.6% → unpublished), not an equivalent | `fireworks/deepseek/flash/v4.1`, or another frontier model |
| `fireworks/kimi/pro/k2.6` | fireworks named two, with opposite tradeoffs | `fireworks/kimi/pro/k3` (keeps vision, 3x input rate) or `fireworks/glm/pro/5.3` (closer price, 1M context, no vision) |
| `fireworks/kimi/code/k2.7` | fireworks named two, and neither is code-specialized | same two |

> to never face this again, move to a versionless slug. that is the whole point of them.

#### removed

these slugs were dropped on 2026-09-16 because their ids answered **404** on a live call:

| slug | id | cause |
| --- | --- | --- |
| `fireworks/qwen/3.7-plus` | `qwen3p7-plus` | 404 on inference, though still in the catalog |
| `fireworks/minimax/2.7` | `minimax-m2p7` | 404 on inference, though still in the catalog |
| `fireworks/gpt-oss/20b` | `gpt-oss-20b` | 404, and absent from the catalog |
| `fireworks/glm/5.1` | `glm-5p1` | pay-per-token deprecated 2026-08-07; provisioned throughput only |

> a deprecation is never fixable by a re-pin, so the slug is removed rather than re-aimed.

### prompt cache

fireworks caches a prompt **prefix** on the replica that served it. on serverless, each call is
handed to an arbitrary replica — so a repeated prefix lands on a replica that never saw it, and
the cache never hits.

this adapter pins the replica for you. every ask that carries `role.briefs` sends an
`x-session-affinity` header derived from the composed system prompt, so calls that share a
prefix are routed together.

```ts
const brainAtom = genBrainAtom({ slug: 'fireworks/deepseek/flash/latest' });

// these two asks share their briefs, so they share an affinity key,
// so the second one reuses the first one's cached prefix
await brainAtom.ask({ role: { briefs }, prompt: 'first question', schema }, context);
await brainAtom.ask({ role: { briefs }, prompt: 'second question', schema }, context);
```

measured on `fireworks/deepseek/flash/v4`, 6 calls per arm, rate over the 5 follow-ups:

| arm | affinity header | hit rate | cached tokens |
| --- | --- | --- | --- |
| control (raw openai client) | none | **0/5 (0%)** | 0 |
| treatment (this adapter) | sent | **5/5 (100%)** | 29,425 |

the test that produced those numbers is committed —
`genBrainAtom.promptCache.integration.test.ts`. it runs both arms against the live api and
isolates them with a run-unique nonce at the head of each system prompt, so neither arm can
warm the other.

what a hit is worth: on `deepseek/flash/v4` a cached token bills at `$0.007` against `$0.22`
— **~31× cheaper**. the discount varies by model (see the `cached input` column above); it is
never free, and it is never zero.

what this means for you:

- **briefs earn the cache.** an ask with no briefs has no prefix to share, so no key is sent.
- **the key is coarse on purpose.** it covers the model and the system prompt only — not the
  prompt, the episode, or the tool defs. a per-request key would pin each call to its own
  replica and hit zero percent.
- **keep briefs byte-stable.** a prompt cache matches a prefix, so one changed byte near the
  head voids every token behind it. a timestamp, uuid, or cwd inside a brief costs you the
  whole cache.
- **the cost model splits the two.** `metrics.size.tokens.input` counts only the **uncached**
  prompt tokens; the cached ones land in `metrics.size.tokens.cache.get`, priced at the
  cached-input rate. so each token is billed exactly once.

> source: [fireworks prompt cache guide](https://docs.fireworks.ai/guides/prompt-caching)

### tool use support

all 12 models support tool use via the openai-compatible function call api. tested capabilities:

| capability | status |
| --- | --- |
| tool invocation | all models |
| tool continuation | all models |
| structured output | all models (without tools) |

## credentials

two patterns for credential injection:

### repo level — keyrack shorthand

auto-discover `FIREWORKS_API_KEY` from keyrack:

```ts
import { genBrainAtom, genContextBrainSupplier } from 'rhachet-brains-fireworksai';

const context = genContextBrainSupplier('fireworks', {
  creds: { keyrack: { owner: 'ehmpath', env: 'prod' } },
});

const brainAtom = genBrainAtom({ slug: 'fireworks/deepseek/flash/latest' });
const { output } = await brainAtom.ask({ ... }, context);
```

### user level — explicit getter

per-request credentials from vault, kms, or multi-tenant source:

```ts
import { genBrainAtom, genContextBrainSupplier } from 'rhachet-brains-fireworksai';

const context = genContextBrainSupplier('fireworks', {
  creds: async () => ({
    FIREWORKS_API_KEY: await vault.get(`tenant/${tenantId}/fireworks`),
  }),
});

const brainAtom = genBrainAtom({ slug: 'fireworks/deepseek/flash/latest' });
const { output } = await brainAtom.ask({ ... }, context);
```

### fallback — environment variable

if no context provided, falls back to `FIREWORKS_API_KEY` environment variable.

get your api key at https://api.fireworks.ai/inference/settings/api-keys

## sources

- [fireworks ai api docs](https://docs.fireworks.ai/reference/chat-completions-1)
- [fireworks ai models](https://docs.fireworks.ai/docs/serverless-models)
- [fireworks ai rates](https://docs.fireworks.ai/serverless/rates)
