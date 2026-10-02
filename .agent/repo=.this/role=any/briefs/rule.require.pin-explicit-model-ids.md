# rule.require.pin-explicit-model-ids

## .what

pin every static model id to the **most explicit form openrouter offers** — the dated id, never a
movable alias.

```
👎 openrouter/deepseek/deepseek-v4-pro          # movable alias
👍 openrouter/deepseek/deepseek-v4-pro-0813     # explicit pin
```

when both an alias and a dated id serve, the config takes the **dated** one.

## .why

a movable alias is a promise the provider can move or withdraw with no diff in our repo:

- **silent weight drift** — the alias re-points to new weights; prompts and evals shift with no
  signal. the run that passed yesterday is not the run we get today
- **alias rot** — the alias is withdrawn while dated ids still serve, so calls 404 on an id a
  catalog may still list

both fire on the provider's clock, not ours. a pin turns an unannounced change into a stable,
legible fact.

**measured 2026-09-16, on this package's predecessor provider:** a flash alias began to 404 while
its dated peer served. every reviewer in every repo that leaned on that alias failed at once —
9 of 9 level-1 reviewers, identically.

## .how

1. **read the catalog** (`GET https://openrouter.ai/api/v1/models`) — never copy an id from a
   blog. ⚠️ this finds **candidates** and proves naught
   (`rule.always.verify-model-ids-by-live-call`)
2. **prefer the dated id** where an alias and a dated id both appear — then probe both live
3. **record the check** — the id and the date verified, in the config comment
4. **keep the slug stable** — a re-pin never changes a static slug; the versionless slug is our
   contract with consumers (`rule.require.versionless-slug-per-tier`)

## .the caveat — a pin is necessary, not sufficient

a pin closes drift and alias rot. it does **not** close withdrawal: a provider may retire a dated
id too. openrouter dates it first, as `expiration_date` on `/models`. so a pin pairs with the live
probe and the live date check; a withdrawn model's tiers are **re-aimed**, never re-pinned.

## .the bound — unlisted ids

this rule governs the **static** catalog. an unlisted id (`openrouter/{author}/{model}` outside
the config) is the caller's own choice; we pass it to openrouter verbatim, after a catalog check.

## .diagnosis aid

| symptom | likely cause | fix |
|---|---|---|
| id 404s, a dated peer serves | alias rot | pin to the dated id |
| id 404s, no peer serves | withdrawn | re-aim each tier that names it; the pin fails named |
| id serves but output shifted | weight drift under an alias | pin to the dated id |

🟡 the middle row's test is **"no peer serves"**, never "no peer in the catalog".

## .enforcement

- a static id that uses a movable alias where a dated id serves = **blocker**
- a static id added without a catalog read AND a live call = **blocker**
- a static id that fails a live call = **blocker**
- a withdrawn model "fixed" by a re-pin rather than a tier re-aim = **blocker**

## .see also

- `rule.always.verify-model-ids-by-live-call` — the serve-ability half
- `rule.require.versionless-slug-per-tier` — the public peer: pin internally, stay versionless
  outward
- `define.brain-config-pattern` — where model ids are declared
