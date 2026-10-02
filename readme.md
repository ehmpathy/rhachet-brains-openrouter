# rhachet-brains-openrouter

rhachet brain.atom adapter for [openrouter](https://openrouter.ai) — any model openrouter serves,
with supply filters written in the slug.

```ts
genBrainAtom({ slug: 'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full' });
//                    └ which model ────────┘ └ which hosts may serve it ────────┘
```

openrouter serves each model from many hosts, at many prices. the slug names the model, and its
filters say which hosts may serve it. the atom sends each ask only to hosts that keep every filter,
and refuses an answer from any other host.

## install

```sh
npm install rhachet-brains-openrouter
```

## setup — account to first call

### 1. make an account

sign up at https://openrouter.ai.

### 2. provision the wallet

add credits at https://openrouter.ai/settings/credits — $10 covers a long trial. leave auto
top-up **off**: then a runaway loop stops at the balance, never at your card's limit.

### 3. mint a key

at https://openrouter.ai/settings/keys, mint a key per use — say `rhachet-dev` for your machine,
`rhachet-ci` for ci. scope each one:

- **credit limit** — e.g. $5. a key with no limit can spend the whole balance
- **limit reset** — e.g. weekly, so the limit bounds a week, not the key's whole life

openrouter shows the key **once**. copy it now.

### 4. store it in keyrack

declare the key in your repo's `.agent/keyrack.yml`, under the env that will use it:

```yaml
env.prod:
  - OPENROUTER_API_KEY
```

then fill it. keyrack prompts for the value, so it never lands in a file or your shell history:

```sh
rhx keyrack fill --owner ehmpath --env prod --key OPENROUTER_API_KEY
```

### 5. confirm it works — one command

```sh
rhx keyrack unlock --owner ehmpath --env prod
```

```sh
node -e "
const { genContextBrainSupplier } = require('rhachet');
const { genBrainAtom } = require('rhachet-brains-openrouter');
const { z } = require('zod');
const context = genContextBrainSupplier('openrouter', { creds: { keyrack: { owner: 'ehmpath', env: 'prod' } } });
genBrainAtom({ slug: 'openrouter/deepseek/flash' })
  .ask({ role: { briefs: [] }, prompt: 'reply with the word ok', schema: { output: z.string() } }, context)
  .then(({ output, metrics }) => console.log('✔ openrouter answered', { output, cost: metrics.cost.cash.total }));
"
```

it prints the answer and what openrouter billed — a fraction of a cent:

```
✔ openrouter answered { output: 'ok', cost: 'USD 0.000004' }
```

## usage

three ways in, most preferred first.

### 1. context discovery — preferred

rhachet discovers this package on its own: it scans your `package.json` for `rhachet-brains-*`
dependencies and registers every atom each one exports. name the brain, and ask:

```ts
import { genContextBrain } from 'rhachet';
import { z } from 'zod';

const { brain } = await genContextBrain({
  choice: { atom: 'openrouter/deepseek/flash' },
  creds: async () => ({ OPENROUTER_API_KEY: await vault.get('openrouter') }),
});

const { output, metrics } = await brain.choice.ask({
  role: { briefs: [] },
  prompt: 'explain this code',
  schema: { output: z.string() },
});
```

### 2. context specification

to hold the brain list in code — say, a sandbox with no `package.json` — register the atoms
yourself. the choice and the ask are the same as above:

```ts
import { genContextBrain } from 'rhachet';
import { getBrainAtomsByOpenRouter } from 'rhachet-brains-openrouter';

const { brain } = genContextBrain({
  brains: { atoms: getBrainAtomsByOpenRouter() },
  choice: { atom: 'openrouter/deepseek/flash' },
  creds: async () => ({ OPENROUTER_API_KEY: await vault.get('openrouter') }),
});
```

### 3. direct access

to reach a slug rhachet does not list — any openrouter id, or your own filters — build the atom
directly:

```ts
import { genContextBrainSupplier } from 'rhachet';
import { genBrainAtom, type BrainSuppliesOpenRouter } from 'rhachet-brains-openrouter';
import { z } from 'zod';

const context = genContextBrainSupplier<'openrouter', BrainSuppliesOpenRouter>('openrouter', {
  creds: { keyrack: { owner: 'ehmpath', env: 'prod' } },
});

const brainAtom = genBrainAtom({ slug: 'openrouter/z-ai/glm-5.3/region=usa' });

const { output, metrics } = await brainAtom.ask(
  { role: { briefs: [] }, prompt: 'explain this code', schema: { output: z.string() } },
  context,
);
```

## slugs

```
openrouter/{author}/{tier}[/{filters}]     a tier     openrouter/deepseek/flash/region=usa
openrouter/{author}/{model}[/{filters}]    any id     openrouter/z-ai/glm-5.3/privacy=full
```

a slug with no filters of its own takes the **default filters**: `floor&speed=min50tps&privacy=full`.
a slug with filters takes its own filters instead, whole — the default does not merge in.

### tiers — the newest model, with no release owed

a tier names an author and a capability, never a version. at ask time the atom reads openrouter's
catalog, picks the newest model on the tier's line that openrouter has not dated for withdrawal,
and holds that pick on this machine for 7 days.

| slug | the line it follows | tier |
| --- | --- | --- |
| `openrouter/deepseek/pro` | `deepseek/deepseek-v{version}-pro` | frontier |
| `openrouter/deepseek/flash` | `deepseek/deepseek-v{version}-flash` | cheapfast |
| `openrouter/moonshotai/pro` | `moonshotai/kimi-k{version}` | frontier |
| `openrouter/z-ai/pro` | `z-ai/glm-{version}` | frontier |
| `openrouter/z-ai/flash` | `z-ai/glm-{version}-flash` | cheapfast |

- **a new version ships** → the next pick takes it, within 7 days. no edit, no release
- **openrouter dates a model for withdrawal** → a held pick of it is dropped at once, and the next
  newest is picked
- **the line holds no live model** → `ConstraintError`, before any call

the tier is in the name on purpose. a bare `{author}/latest` would let a cheapfast caller drift onto
a frontier model at many times the rate, with no signal.

a tier's `spec` (rates, context, speed) is an **estimate for the tier**, not a quote for the model
it picks — frontier $3 / $15 per 1M, cheapfast $0.30 / $2.00 per 1M. ci checks that each estimate
sits at or above the cheapest live rate of the model picked today.

### any openrouter id — one exact model

name an openrouter id to hold one exact model, say for an eval or a snapshot suite:

```ts
genBrainAtom({ slug: 'openrouter/deepseek/deepseek-v4.1-flash' });
```

before any spend, the atom checks the id against openrouter's catalog. a typo is refused with the
nearest ids, as ready slugs, with your filters kept:

```
✋ ConstraintError: openrouter lists no model 'z-ai/glm-5.3-flahs'. no call was sent.

did you mean one of these?
  - openrouter/z-ai/glm-5.3-flash/floor
  ...
see every id: https://openrouter.ai/models
```

a withdrawn id fails with the date it was withdrawn, and the nearest live ids. every id shares one
**placeholder** `spec` ($3 / $15 per 1M, 128K context).

### which names rhachet can choose

rhachet matches a `choice` by exact name, so only listed names are choosable through
`genContextBrain`, by discovery or by list: the five tiers, and
`openrouter/deepseek/flash/floor&speed=min50tps&privacy=full`. for any other slug, call
`genBrainAtom({ slug })` directly.

## supply filters — each word is a promise

join words with `&`, in any order, each key once.

| word | the promise | how it holds |
| --- | --- | --- |
| `floor` | the cheapest endpoint, by input rate, that keeps every other promise | ranked live; one endpoint per attempt; a throttle, refusal, or bad reply moves on to the next cheapest |
| `speed=min50tps` · `speed.min=50tps` | only endpoints with a measured p50 ≥ 50 tok/s over the last 30 min | an unmeasured endpoint is excluded |
| `precision=fp8` | only that quantization (`int4` `int8` `fp4` `fp6` `fp8` `fp16` `bf16` `fp32`) | filtered, plus openrouter's native `quantizations` |
| `privacy=full` | only endpoints on openrouter's zero-data-retention list | filtered, plus native `zdr: true` and `data_collection: deny` |
| `region=usa` | only endpoints whose tag carries a usa region (`{provider}/us`, `{provider}/us-east`) | a company's domicile is not its datacenter, so a base tag never qualifies |
| `price.max=0.5usd/M` | never billed above this rate, for input **and** output alike | native `max_price`, one bound on both rates; no cap without this word |

and always:

- your schema and tools are honored (`require_parameters: true`), so an endpoint that cannot serve
  them is never chosen
- a json ask goes only to endpoints that declare `structured_outputs`. a host that answers prose
  where json was owed is skipped on this machine for 7 days

### what is enforced, and what is attested

- **enforced** — every call names the endpoints it accepts (`only: [...]`, no fallback). the
  response must name one of them, or no answer is returned
- **attested** — that a host keeps no data (`privacy`), runs the quantization it declares
  (`precision`), or sits in the region its tag names (`region`) is the host's own claim, screened
  by openrouter. no client can observe it

### the charge, and the supply report

`metrics.cost.cash.total` is openrouter's own charge (`usage.cost`). the per-token breakdown beside
it is an estimate from the `spec`, and may not sum to the total.

each ask also reports how it was supplied, as `output.supply`. rhachet's `BrainOutput` does not
declare that field yet, so read it through a cast:

```ts
import type { SupplyReport } from 'rhachet-brains-openrouter';

const result = await brainAtom.ask({ ... }, context);
const supply = (result as unknown as { supply: SupplyReport }).supply;
// supply.provider       who served
// supply.generationId   audit the served endpoint later via GET /generation
// supply.attempts       each endpoint tried, in order; the last one 'served'
// supply.choice         how many endpoints survived each filter, and each rate
```

### refusals — each names its fix

| when | error |
| --- | --- |
| a filter word is unknown or malformed | `ConstraintError`, before any call — names the word and the valid set |
| no endpoint keeps every promise | `ConstraintError`, before any call — the funnel shows which promise emptied it |
| an id openrouter does not list | `ConstraintError`, before any call — the nearest ids |
| a tier whose line holds no live model | `ConstraintError`, before any call — names the line |
| a literal pattern, e.g. `openrouter/*/*` | `ConstraintError` — a pattern is not a model |
| every qualified endpoint throttles, refuses, or answers badly | `MalfunctionError` — each attempt listed |
| openrouter has withdrawn the model | `ConstraintError` — the date it was withdrawn, and the nearest live ids |
| the response names a provider the call did not accept | `MalfunctionError` — the answer is withheld |
| 402 no credits · 401 bad key | `ConstraintError` — names the credits page or the keyrack fill |

### what the atom remembers, and for how long

each read below is cached on disk under `~/.rhachet/storage/repo=openrouter/role=any/cache/`, and
shared by every process on the machine:

| read | held for |
| --- | --- |
| the model catalog | 60 min |
| the endpoint list, per model | 30 min — the window of openrouter's throughput stat |
| the zero-retention list | fresh for 60 min, then served while a refresh runs behind, up to 24h |
| the model each tier picked | 7 days, or until openrouter dates it for withdrawal |
| a host that answered prose where json was owed | 7 days |

a stale zero-retention list is safe: each `privacy=full` call also sends `zdr: true`, so openrouter
refuses an endpoint that left the list. the api key never enters a cache key. the reads cost ~190ms
cold and naught warm.

## tool use

tools are sent via openrouter's openai-compatible function call api, with invocation and
continuation. a tool's slug is sent as a function name in `[a-zA-Z0-9_-]`, so `weather.lookup`
goes as `weather_lookup` and comes back as `weather.lookup`. two slugs that would send under one
name are refused before any call.

structured output works without tools; with tools plugged, the output schema must be `z.string()`.

## credentials

a context is required; there is no environment fallback. `genContextBrainSupplier` comes from
`rhachet`.

### keyrack shorthand

```ts
const context = genContextBrainSupplier('openrouter', {
  creds: { keyrack: { owner: 'ehmpath', env: 'prod' } },
});
```

### explicit getter

per-request credentials from a vault, kms, or multi-tenant source:

```ts
const context = genContextBrainSupplier('openrouter', {
  creds: async () => ({
    OPENROUTER_API_KEY: await vault.get(`tenant/${tenantId}/openrouter`),
  }),
});
```

## sources

- [openrouter api reference](https://openrouter.ai/docs/api-reference/chat-completion)
- [openrouter provider route docs](https://openrouter.ai/docs/features/provider-routing)
- [openrouter models](https://openrouter.ai/models)
