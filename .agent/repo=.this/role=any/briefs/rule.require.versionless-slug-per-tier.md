# rule.require.versionless-slug-per-tier

## .what

every model family this package exposes carries a **versionless slug per tier it
publishes**, beside its version-pinned slugs.

```
👎  fireworks/deepseek/v4.1-flash          # pinned only — the caller owns the churn
👍  fireworks/deepseek/flash/latest        # versionless — we own the churn
    fireworks/deepseek/flash/v4.1          # …and the pin stays, for callers who want it
```

🟡 **one shape covers both**: `fireworks/{family}/{tier}/{version|latest}`. the pin and the
generic differ in ONE segment, so a caller moves between them by a single word — and a reader
can tell at a glance which they hold. a generic in one shape beside a pin in another
(`{family}/{tier}/latest` vs `{family}/{version}-{tier}`) hides that relation and invites a
typo the type union then rejects for no legible reason.

the versionless slug **adds**; it never replaces a pin.

🔴 **and it must be SELECTABLE.** each generic is exported as its own atom in
`getBrainAtomsByFireworksAI()`, under its own name, and so is its bare shorthand
`fireworks/{family}/{tier}`. a generic the type union accepts but the registry omits cannot be
chosen by any consumer ⇒ `rule.require.versionless-slugs-selectable`.

## .why — a version in a public slug exports the provider's clock to our consumers

a slug is a contract. put a version number in it and every consumer has signed up for a
deadline they did not choose and cannot see.

| the provider does | with a pinned slug only | with a versionless slug |
|---|---|---|
| ships v4.1 beside v4 | consumer edits, or stays behind | one line here, nobody edits |
| retires v4 | **every consumer breaks** | one line here, nobody notices |
| renames a variant | consumer edits | one line here |

⇒ the work is identical either way — **someone** must re-aim the slug. the only question is
whether it is done ONCE here, or N times across every repo that depends on us.

**measured 2026-09-22.** fireworks announced retirements for five of this package's twelve
models at once. two had a single named successor and could be routed; three did not, and no
alias can honestly fix those. a consumer on a versionless slug felt none of it. a consumer
on a pin felt all of it.

## 🔴 .why the tier partition, and not a bare `{family}/latest`

a bare `fireworks/deepseek/latest` collapses the frontier and cheapfast tiers into one name.
so a caller who chose a cheap model could wake up on a frontier one at **6x the input rate**
— `$0.22` against `$1.32` — with no edit and no signal.

> **version is the axis a caller does NOT care about. tier is the axis they chose on.**

⇒ so the versionless slug drops the version and keeps the tier. that is the whole design.

## .how — the tier is READ, never invented

each model's `description` in `BrainAtom.config.ts` already carries its tier word:

| the description says | the tier is |
|---|---|
| `frontier` | `pro` |
| `cheapfast`, `cheapest` | `flash` |
| code-specialized | `code` |

⇒ so the assignment is read off the catalog rather than judged. a model whose description
carries no tier word is a **catalog defect** — fix the description, then assign.

## 🔴 .the one exception — a DISCONTINUED tier, with a provider-named successor

where a provider retires a whole tier **and names a successor in another tier**, the generic
follows the provider across the tier line. it does not vanish, and it does not lie about what
it now names.

**measured 2026-09-22.** deepseek's pro tier was discontinued and fireworks named
`v4.1-flash` — a cheapfast model — as `v4-pro`'s successor. so
`fireworks/deepseek/pro/latest` points at a cheapfast model: `$1.32` → `$0.22` input,
swe-bench 80.6% → unpublished.

⚠️ this is a real capability drop, so it is **recorded, never silent** — in the registry note,
in the readme, and in a test that pins the pair. when the provider ships a true successor for
that tier, the generic re-aims and the drop is undone.

## 🔴 .the exception does NOT extend to the pinned slug

this is the sharpest line in the whole scheme, and it is easy to erase by accident:

| the caller named | what it means | so a cross-tier successor is |
|---|---|---|
| `{family}/{tier}/latest` | *"choose for me; I care about the tier, not the version"* | **taken** — they delegated |
| `{family}/{version}` | *"this exact model, this exact capacity"* | 🔴 **refused** — they chose, and a swap is silent harm |

⇒ delegation is the only difference, and it is the whole justification. a change that routes
the PINNED slug across a tier drops a frontier caller onto a cheap model with no signal —
exactly what `RETIREMENT_BY_ATOM_SLUG` marks `AMBIGUOUS` to prevent.

## .the bound — three states of a tier, and only one earns a generic

🔴 **the discriminator is whether the provider named ONE place for those callers to go.**

| the family's tier | the generic |
|---|---|
| publishes a live model | ✅ **owed** — that is this rule |
| **never published** | ⛔ **absent**. kimi has no cheapfast model, so no `kimi/flash/latest` |
| published, then discontinued, **one named successor** | ✅ **stays**, and follows the successor — the exception above |
| published, then discontinued, **no single successor** | ⛔ **absent**. the pin stays and serves; the caller picks |

**measured 2026-09-22.** kimi's code tier holds exactly one model, `kimi/code/k2.7`, retired
with TWO successors of opposite tradeoffs. so there is no `fireworks/kimi/code/latest`.

⚠️ **this is the sharpest of the four rows, because the generic would WORK today.** it would
name a model that serves, pass every test, and fail the day fireworks withdraws that id — for
exactly the callers who took a generic to never feel a withdrawal. ⇒ an empty generic is a
name that reaches naught; a doomed generic is worse, because it hides its own expiry.

🟡 the pin is untouched in both absent rows. `kimi/code/k2.7` still serves, still carries its
legacy alias, and fails with a named error once it 404s.

## 🔴 .a generic must never name a retired model

a generic exists so a consumer never feels a retirement. one that lands on a model with
a live retirement is a **scheduled break under a safe name** — it works today and fails the
day the provider withdraws that model, for every caller who took the generic precisely to
avoid that.

⇒ so when a model a generic names is retired, re-aim the generic in the SAME change. this is
mechanized: `asPinnedAtomSlug.test.ts` fails if any generic lands on a retired slug.

## .when it fires

| when… | then… |
|---|---|
| you add a model to a family that has **no** generic for its tier | add the generic in the same change |
| you add a model that **supersedes** the one a generic names | re-aim the generic. that is the one edit that saves N |
| you retire a model a generic names | re-aim the generic **before** the retirement lands |
| a family publishes a **new tier** | that tier earns its own generic |
| you are tempted by a bare `{family}/latest` | 🔴 it crosses tiers silently. see above |
| a model's description carries no tier word | fix the description first; do not guess the tier |
| you would **remove** a pin to force callers onto a generic | 🔴 forbidden. the pin is the escape hatch, and removal is the churn this rule exists to prevent |

## .the pin still matters — this rule does not deprecate it

`rule.require.pin-explicit-model-ids` is untouched. the two answer different questions:

| | the pin | the versionless slug |
|---|---|---|
| answers | *which exact weights?* | *which capability?* |
| serves | a caller who needs byte-stable output — an eval, a snapshot suite | a caller who wants the job done and never to think about it again |
| on a provider version bump | stays put, by design | follows, by design |

⇒ **both are correct, for different callers.** a package that offers only pins exports its
churn; a package that offers only generics denies reproducibility. offer both.

## .enforcement

- a model family with a published tier and no versionless slug for it = **blocker**
- a versionless slug that spans tiers (`{family}/latest` with no tier segment) = **blocker**
- a versionless slug that lands on a slug with no config = **blocker**
- a versionless slug that lands on a **retired** model = **blocker** (a scheduled break)
- a versionless slug and its pin in **different shapes** = **blocker** (one shape, one segment apart)
- a version-pinned slug REMOVED to push callers onto a generic = **blocker**
- a tier assigned against what the model's own `description` says, with **no** recorded
  discontinued-tier exception = **blocker**
- a cross-tier exception taken with no note in the registry, the readme, AND a test = **blocker**
- 🔴 a **pinned** slug routed across a tier line = **blocker** (the caller chose that capacity)
- a versionless slug declared for a tier the family NEVER published = **blocker**

## .see also

- `rule.require.pin-explicit-model-ids` — the pin half; this rule adds a peer, never replaces it
- `rule.always.verify-model-ids-by-live-call` — a re-aimed generic still owes a live probe
- `define.brain-config-pattern` — where `PINNED_BY_LATEST_SLUG` is declared
- `atom/slug/` — the cluster: `AtomSlug.{latest,legacy,retired}.ts` declare the three
  non-pinned forms, and `asPinnedAtomSlug.ts` walks any of them onto the model it names
