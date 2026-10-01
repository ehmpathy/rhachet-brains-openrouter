# rule.require.redirected-slugs-selectable

## .what

every name `genBrainAtom` accepts is exported as its own atom, **under the name the consumer
holds**. that includes every **redirect** — a name we shipped that now reaches its model through
a map:

| redirect | map | on choice | on ask |
|---|---|---|---|
| legacy rename | `PINNED_BY_LEGACY_SLUG` | found | the pin answers |
| retired, one successor | `RETIREMENT_BY_ATOM_SLUG` `ROUTED` | found | the successor answers |
| retired, several | `RETIREMENT_BY_ATOM_SLUG` `AMBIGUOUS` | found | 🔴 our error, which lists each replacement |

```
getBrainAtomsByFireworksAI()
  fireworks/deepseek/v4-flash     # legacy  — the name a consumer holds…
  fireworks/deepseek/flash/v4     # retired — …another name they may hold…
  fireworks/deepseek/flash/v4.1   # pinned  — …one brain, three atoms
```

## .why — the only reason to track a redirect is to honor it

we keep legacy and retired names for one purpose: a consumer who names one still gets a brain.
a consumer never calls `genBrainAtom`. it registers `getBrainAtomsByFireworksAI()` and names a
`choice`, which rhachet matches against `atom.slug`, **exact**. so:

| the name is | `genBrainAtom` accepts it | in the registry | a consumer who chooses it gets |
|---|---|---|---|
| honored | ✔ | ✔, as named | the brain — or our named error |
| accepted only | ✔ | ✘ | 🔴 `BrainChoiceNotFoundError`, with no hint of a fix |

⇒ **a name `genBrainAtom` accepts and the registry omits is a broken promise behind a green
unit suite.** even a withdrawn model is owed its atom: an absent name says "no such brain"; a
listed one says "retired — here are the replacements".

**measured 2026-09-27.** through v0.2.1, all twelve legacy names and all five retirements were
accepted, absent from the registry, and renamed to their successor on the atom. consumers
reported `fireworks/deepseek/v4-flash` "not accessible". the v0.2.0 `/latest` defect
(`rule.require.versionless-slugs-selectable`) had been fixed for versionless names only — by a
hand edit to a hand-kept list, so the same defect sat untouched one map over.

## 🔴 .how — three guards, so it cannot recur

| guard | what it closes |
|---|---|
| **the registry is DERIVED from the slug maps** — `getAllAtomSlugs().map(genBrainAtom)` | each map is a `Record` over its own union, so every name is listed once, in its map. a name added to any map is selectable by construction |
| **the atom keeps its name** — `slug: input.slug`, never the pin | a renamed atom is one no consumer can find by the name they hold. the pin goes in the description |
| **the clamp takes the consumer's path, with LITERALS** | a derived check agrees with a map that lost a row. a literal list of every name we ever shipped does not |

the clamp, concretely:

- `getBrainAtomsByFireworksAI.unit.test.ts` — `SLUGS_PROMISED_FOREVER`, every legacy and retired
  name as a literal, each chosen through rhachet's real `genContextBrain`. explicit mode is pure and
  in-memory, so it runs on **every** CI pass with no credentials. it went 7/7 red when the atom was
  made to carry its pin again.
- `getBrainAtomsByFireworksAI.acceptance.test.ts` — the **built package** via its self-link: every
  redirect chosen by name; `fireworks/deepseek/v4-flash` asked a live question; `fireworks/kimi/k2.6`
  asked live and shown to fail with the named replacements.

## .when it fires

| when… | then… |
|---|---|
| you add a legacy name | add it to its map AND to `SLUGS_PROMISED_FOREVER` |
| you retire a pin, either kind | add it to `SLUGS_PROMISED_FOREVER`. its atom stays |
| you would remove a name from `SLUGS_PROMISED_FOREVER` | 🔴 forbidden. the list only grows |
| you would rename an atom to the model it reaches | 🔴 forbidden. put the pin in the description |
| you would hand-list atoms in `getBrainAtomsByFireworksAI` | 🔴 forbidden. derive them |
| a consumer reports a name "not accessible" | choose it through `genContextBrain`, never `genBrainAtom` |

## .enforcement

blocker:
- a name accepted by `genBrainAtom` and absent from the registry
- an atom whose `slug` differs from the name it was built from
- a registry kept by hand rather than derived from the slug maps
- a name removed from `SLUGS_PROMISED_FOREVER`
- a clamp that proves acceptance (`genBrainAtom`) rather than selection (`genContextBrain`)

## .see also

- `rule.require.versionless-slugs-selectable` — the same law, for `/latest` and bare names
- `rule.require.pin-explicit-model-ids` — the slug is our contract; a re-pin never changes it
- `rule.always.verify-model-ids-by-live-call` — a redirect reaches an extant pin, so it needs no
  new model probe; the acceptance ask proves the path, end to end
