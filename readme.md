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
  creds: { keyrack: { owner: 'ehmpath', env: 'prod' } },
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
  creds: { keyrack: { owner: 'ehmpath', env: 'prod' } },
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
a slug with filters takes its own filters instead, whole — the default does not merge in. the one
exception is a segment of `sort` alone, which orders hosts and promises naught, so it keeps the
default.

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

a tier's rates are an **estimate for the tier**, not a quote for the model it picks — frontier
$3 / $15 per 1M, cheapfast $0.30 / $2.00 per 1M. ci checks that each estimate sits at or above the
cheapest live rate of the model picked today.

a tier's context is its pick's window, **rounded down to a grain** (1M, 250K, 200K) — 1M for
every tier today. hosts of one model differ by a few percent, so the grain fits every host. ci
checks it against the live pick.

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
**placeholder** `spec` ($3 / $15 per 1M, 1M context). a prompt past what a model supports is
refused by openrouter, loud.

### which names rhachet can choose

rhachet matches a `choice` by exact name, so only listed names are choosable through
`genContextBrain`, by discovery or by list: the five tiers,
`openrouter/deepseek/flash/floor&speed=min50tps&privacy=full`, and its fastest-first twin
`openrouter/deepseek/flash/floor&speed=min50tps&privacy=full&sort=throughput`. for any other slug, call
`genBrainAtom({ slug })` directly.

## supply filters — each word is a promise

join words with `&`, in any order, each key once.

| word | the promise | how it holds |
| --- | --- | --- |
| `floor` | the cheapest endpoint, by input rate, that keeps every other promise | ranked live; one endpoint per attempt; a throttle, a refusal, a 502/503/504, a bad reply, a cut body, or a host silent for 10 min moves on to the next; the walk stops after two stalled hosts, and names the hosts left untried |
| `speed=min50tps` · `speed.min=50tps` | only endpoints with a measured p50 ≥ 50 tok/s over the last 30 min | an unmeasured endpoint is excluded |
| `precision=fp8` | only that quantization (`int4` `int8` `fp4` `fp6` `fp8` `fp16` `bf16` `fp32`) | filtered, plus openrouter's native `quantizations` |
| `privacy=full` | only endpoints on openrouter's zero-data-retention list | filtered, plus native `zdr: true` and `data_collection: deny` |
| `region=usa` | only endpoints whose tag carries a usa region (`{provider}/us`, `{provider}/us-east`) | a company's domicile is not its datacenter, so a base tag never qualifies |
| `price.max=0.5usd/M` | never billed above this rate, for input **and** output alike | native `max_price`, one bound on both rates; no cap without this word |
| `sort=throughput` · `sort=price` · `sort=latency` | the order hosts are tried in, among those that keep every promise | native `provider.sort`; under `floor`, the walk itself tries the fastest first for `throughput`. `latency` is refused under `floor` until a per-host latency figure is read. no key is sent without this word |

and always:

- your schema and tools are honored (`require_parameters: true`), so an endpoint that cannot serve
  them is never chosen
- a json ask goes only to endpoints that declare `structured_outputs`. a host that answers prose,
  or 0 chars, where json was owed is skipped on this machine for 7 days

### `sort`, beside the other words

- `sort` orders hosts among those that keep every promise; it never admits a host a promise drops.
  an affinity pin, once one lands, picks first, and `sort` orders what the pin leaves
- a segment of `sort` alone keeps the default promises: `openrouter/deepseek/flash/sort=throughput`
  is `floor&speed=min50tps&privacy=full&sort=throughput`. a segment that writes any promise
  replaces the default whole, as for every other word. a lone `sort=latency` meets the default's
  `floor`, so it is refused, as the written-out slug would be
- without `floor`, openrouter tries the admitted set in sort order. fallbacks are on inside
  `only` (`allow_fallbacks: true`), so a throttled top host steps aside for the next. `only` still
  bounds every hop, so no fallback leaves the hosts that keep your promises. an ask with no sort
  keeps 0.1.3's `allow_fallbacks: false`

### what is enforced, and what is attested

- **enforced** — every call names the endpoints it accepts (`only: [...]`), and no hop, fallback
  included, leaves that list. the
  response must name one of them, or no answer is returned
- **attested** — that a host keeps no data (`privacy`), runs the quantization it declares
  (`precision`), or sits in the region its tag names (`region`) is the host's own claim, screened
  by openrouter. no client can observe it

### the charge, and the supply report

`metrics.cost.cash.total` is openrouter's own charge (`usage.cost`) for the reply that served. the
per-token breakdown beside it is an estimate from the `spec`, and may not sum to the total. on a
`floor` walk, a host the walk stepped past may have billed too (an empty or prose reply, say);
that spend is in openrouter's activity log, not in `cash.total`.

each ask also reports how it was supplied, as `output.supply`. rhachet's `BrainOutput` does not
declare that field yet, so read it through a cast:

```ts
import type { SupplyReport } from 'rhachet-brains-openrouter';

const result = await brainAtom.ask({ ... }, context);
const supply = (result as unknown as { supply: SupplyReport }).supply;
// supply.provider       who served
// supply.generationId   audit the served endpoint later via GET /generation
// supply.attempts       each hop, in order — see below
// supply.choice         how many endpoints survived each filter, each rate, and the sort
```

`supply.attempts` lists each endpoint tried, in order, in both supply modes. the last row is the
endpoint that served, marked `served`. each row before it is a host fault: `throttled`,
`refused`, `failed`, `body-cut`, `stalled`, or a json ask the host answered in prose (`prose`) or
with 0 chars (`empty`).

- **floor** — one row per endpoint tried, in queue order (cheapest first, or fastest first under
  `sort=throughput`)
- **no floor** — one row per endpoint dropped after a host fault. a send that serves at once
  holds one row: the serve

the hops are silent on success. log `supply.attempts` to see why an ask ran slow.

### host faults

both modes step past a host that faults: a 429 (`throttled`), a 404 (`refused`), a 400 that
openrouter marks as the host's own (`Provider returned error`, or a named host), or a 502/503/504
— the last two `failed`. the floor walk steps to the next endpoint. without a floor, the host
openrouter named leaves the admitted set and the ask is re-sent to the rest. a bare 500 may be
openrouter's own fault, so it rethrows untouched, as 0.1.3.

the floor walk also steps past a reply the host broke: one that failed mid-reply (`failed`), a
json ask answered in prose (`prose`) or with 0 chars (`empty`) — both hosts skipped by json asks
for 7 days on this machine — a body cut mid-json (`body-cut`), and a host that sent no whole reply
inside the 10-minute hop bound (`stalled`). a walk stops after two stalls. a reply cut at the
output limit never steps: the next host would spend the same thought again.

a host fault openrouter marks as a host's (`Provider returned error`) yet names no admitted host
cannot say which host to drop, so the rest of the ask walks the set one endpoint per send, as a
floor walk does. without a floor, a fault with no host mark is openrouter's own answer — its
`429 Rate limit exceeded` (the account limit), or a 404 for a withdrawn model. no other host can
fix it, so it rethrows untouched after one send. a cut body or a stall names no host either, so
without a floor it ends in `HostFaultError` after one send. the floor walk admits one endpoint per
send, so it reads any 429 or 404 as that endpoint's and steps on. a caller's own 400 rethrows as
it came, after one send, in both modes.

openrouter's `retry-after` is reported in the refusal, not waited on between hops. the openai
client retries each 429 twice on its own before a hop, and those retries do wait out
`retry-after`, up to 60s each. so a host that asks for 30s costs about a minute before the hop. a
walk after a marked fault that names no host retries twice more per host, so it costs about two
minutes before the next host serves.

## thought cap — effort

a model that thinks before it answers can spend its whole reply on thought. cap it per ask with
rhachet's `effort`, which goes to openrouter as `reasoning`:

```ts
const result = await brainAtom.ask(
  { role, prompt, schema: { output }, effort: { budget: { tokens: 6000 } } },
  context,
);
result.metrics.size.tokens.thought; // thought tokens the host spent, or null where it reports none
```

`thought` is a part of `output`, not an addition to it: the host bills thought as output tokens,
and `output` already counts them. never add `thought` on top of `output`.

| `effort` | sent as | note |
| --- | --- | --- |
| unset | no `reasoning` key | the host's default, as before |
| `{ budget: { tokens: N } }` | `reasoning: { max_tokens: N }` | N a positive integer |
| `'low'` · `{ level: 'low' }` | `reasoning: { effort: 'low' }` | `minimal` `low` `medium` `high` (`spec.supports.effort`) |

an ask with `effort` goes only to hosts that list `reasoning`, and a budget goes only to hosts
whose output limit exceeds it, so the answer has room. a reply that still spent every output
token on thought and wrote no answer is refused by name, with the budget to set.

⚠️ a host that lists `reasoning` may still not honor a budget. measured 2026-10-21 on a
thought-heavy prompt: deepseek flash's host thought 179–489 tokens under every budget from 300 to
2400, while z-ai flash's host thought 875–1218 whatever the budget. `metrics.size.tokens.thought`
shows what each ask spent, and an all-thought reply from a host that overran its budget names
that host rather than a lower budget.

⚠️ `effort` comes from rhachet's open proposal ehmpathy/rhachet#595. this package patches its local
rhachet with that shape (`patches/rhachet@1.50.0.patch`); a consumer's rhachet types accept
`effort` once #595 releases.

⚠️ **every ask now carries a 10-minute bound per hop, set or not.** an ask with no `effort` and no
`sort` sends the 0.1.3 request body byte for byte, but a host that sends no whole reply inside 10
minutes now ends in a named error rather than a hang, and a no-`floor` host that cuts its body ends
in `HostFaultError` rather than a raw `SyntaxError`. the bound is fixed; to make a slow ask finish
inside it, cap thought via `effort`. a `floor` walk stops after two stalled hosts, so stalls cost
it at most about 20 minutes before the named error. other failed hops are not bounded by count:
a host that answers 0 chars after long thought costs its own time, then the walk moves on. a hop the bound aborts may
still be billed by its host; that spend shows in no metric, since no reply came back to read.

the supply report changes shape too, for every ask: a json ask's funnel shows one step per param
(`supports(response_format)`, then `supports(structured_outputs)`) where 0.1.3 showed one combined
step, and `supply.choice` gains `sort` (`null` where the slug writes none).

### refusals — each names its fix

| when | error |
| --- | --- |
| a filter word is unknown or malformed | `ConstraintError`, before any call — names the word and the valid set |
| no endpoint keeps every promise | `ConstraintError`, before any call — the funnel shows which promise emptied it |
| an id openrouter does not list | `ConstraintError`, before any call — the nearest ids |
| a tier whose line holds no live model | `ConstraintError`, before any call — names the line |
| a literal pattern, e.g. `openrouter/*/*` | `ConstraintError` — a pattern is not a model |
| an `effort` that is malformed, or names a level not in `spec.supports.effort` | `ConstraintError`, before any call — the valid shapes |
| `sort=latency` under `floor` | `ConstraintError`, before any call — names `sort=throughput`, or a slug with no `floor` |
| every qualified endpoint throttles, refuses, fails with its own error, cuts its body, stalls, or answers badly — with or without a floor | `MalfunctionError` — each attempt listed, openrouter's `retry-after`, and the last host's own reason (e.g. a context limit, which needs a fix to the request, not a retry) |
| on a slug with no `floor`, the admitted host cuts its body or sends no whole reply inside 10 min | `HostFaultError` (a `MalfunctionError`, `fault: body-cut` or `stalled`), naming every admitted host — never a raw `SyntaxError`, never a hang. add `floor` to step past a faulted host |
| two hosts stall in one walk | `MalfunctionError` — the walk stops; each attempt listed, and the count of hosts left untried |
| the host spent every output token on thought and wrote no answer | `MalfunctionError` (`metadata.defect: 'all-thought'`) — the thought count, and the fix: a budget to set, a lower level, or, where the host thought far past the budget, a note that it ignored the cap |
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
| a host that answered prose, or 0 chars, where json was owed | 7 days |

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
