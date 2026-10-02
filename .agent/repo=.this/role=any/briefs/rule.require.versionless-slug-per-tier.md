# rule.require.versionless-slug-per-tier

## .what

every author this package lists carries a **versionless slug per tier it publishes**, beside
its pinned ids.

```
👎  openrouter/deepseek/deepseek-v4.1-flash    # pinned only — the caller owns the churn
👍  openrouter/deepseek/flash                  # versionless — we own the churn
    openrouter/deepseek/flash/latest           # …the same, spelled out
    openrouter/deepseek/deepseek-v4.1-flash    # …and the pin stays, for callers who want it
```

the versionless slug **adds**; it never replaces a pin. each is selectable by name
(`rule.require.versionless-slugs-selectable`).

## .why — a version in a public slug exports the provider's clock to our consumers

a slug is a contract. put a version in it and every consumer signs up for a deadline they did
not choose and cannot see.

| the provider does | with a pinned slug only | with a versionless slug |
|---|---|---|
| ships v4.2 beside v4.1 | consumer edits, or stays behind | one line here, nobody edits |
| retires v4.1 | **every consumer breaks** | one line here, nobody notices |

⇒ **someone** must re-aim the slug. the only question is whether it is done ONCE here, or N times
across every repo that depends on us.

## 🔴 .why the tier partition, and not a bare `{author}/latest`

a bare `openrouter/deepseek/latest` collapses the frontier and cheapfast tiers into one name. so
a caller who chose a cheap model could wake up on a frontier one — `$0.03` against `$0.66` input
per 1M today, 22x — with no edit and no signal.

> **version is the axis a caller does NOT care about. tier is the axis they chose on.**

## .how — the tier is READ, never invented

each model's `description` in `BrainAtom.config.ts` carries its tier word:

| the description says | the tier is |
|---|---|
| `frontier` | `pro` |
| `cheapfast` | `flash` |

⇒ a model whose description carries no tier word is a **catalog defect** — fix the description,
then assign.

## .the bound — three states of a tier, and only one earns a generic

| the author's tier | the generic |
|---|---|
| has a model in our catalog | ✅ **owed** — this rule |
| has **no** model in our catalog | ⛔ **absent**. kimi has no cheapfast model here, so no `openrouter/moonshotai/flash` |
| its model is withdrawn, **one** named successor in the same tier | ✅ **stays**, re-aimed |
| its model is withdrawn, **no single** successor | ⛔ **absent**. the pin stays; the caller picks |

🔴 **a generic must never name a dated model.** openrouter dates each withdrawal as
`expiration_date` on `/models`; a generic that names a dated pin is a scheduled break under a safe
name. re-aim it once the date appears, weeks before it lands. mechanized:
`BrainAtom.config.integration.test.ts` [case3] reads the live catalog and fails if any generic
names a model openrouter has dated or dropped.

🔴 **a cross-tier move is never silent.** if a provider discontinues a tier and names a successor
in another tier, a generic may follow only with a note in the registry, the readme, and a test.
a **pinned** slug never crosses a tier: the caller chose that capacity.

## .when it fires

| when… | then… |
|---|---|
| you add a model in a tier that has no generic | add the generic in the same change |
| you add a model that **supersedes** the one a generic names | re-aim the generic, and probe it live |
| openrouter dates a model a generic names | re-aim the generic **before** the date lands |
| you are tempted by a bare `{author}/latest` | 🔴 it crosses tiers silently |
| you would **remove** a pin to force callers onto a generic | 🔴 forbidden. the pin is the escape hatch |

## .the pin still matters

| | the pin | the versionless slug |
|---|---|---|
| answers | *which exact weights?* | *which capability?* |
| serves | an eval, a snapshot suite | a caller who wants the job done |
| on a provider version bump | stays put, by design | follows, by design |

⇒ **both are correct, for different callers.** offer both.

## .enforcement

- an author with a cataloged tier and no versionless slug for it = **blocker**
- a versionless slug that spans tiers (`{author}/latest`) = **blocker**
- a versionless slug that lands on a slug with no config = **blocker**
- a versionless slug that lands on a model openrouter has **dated** = **blocker**
- a pinned slug REMOVED to push callers onto a generic = **blocker**
- a tier assigned against what the model's own `description` says = **blocker**
- 🔴 a **pinned** slug routed across a tier line = **blocker**

## .see also

- `rule.require.pin-explicit-model-ids` — the pin half
- `rule.require.versionless-slugs-selectable` — each generic must be selectable
- `rule.always.verify-model-ids-by-live-call` — a re-aimed generic still owes a live probe
- `atom/slug/` — `AtomSlug.latest.ts` declares the versionless forms; `asPinnedAtomSlug.ts`
  casts each onto the model it names
