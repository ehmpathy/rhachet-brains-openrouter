# rule.require.versionless-slugs-selectable

## .what

every versionless slug is **exported as its own atom, under its own name** — in the same
registry, beside the pin it reaches today.

```
getBrainAtomsByOpenRouter()
  openrouter/deepseek/flash                  # bare      — the same brain…
  openrouter/deepseek/flash/latest           # latest    — …the same brain…
  openrouter/deepseek/deepseek-v4.1-flash    # pinned    — …the same brain
```

one brain, three names, three atoms. each atom carries the name it was exported under as
`atom.slug`, and the spec of the pin it reaches.

## .why — a name a consumer cannot SELECT is a name that does not exist

a consumer never calls `genBrainAtom`. it registers `getBrainAtomsByOpenRouter()` and names a
`choice`, matched against `atom.slug`. so:

| the name is | in the type union | in the registry | a consumer can choose it |
|---|---|---|---|
| accepted and exported | ✔ | ✔ | ✔ |
| accepted, **not** exported | ✔ | ✘ | 🔴 **no** — the union lies |

⇒ acceptance by `genBrainAtom` proves naught. **the registry is the contract.**

**measured 2026-09-26, on this package's predecessor:** a release shipped every `/latest` slug in
the type union and left all of them out of the registry "to avoid duplicates". a consumer's
choice failed with the full available list printed beside it — and not one versionless name in
it.

## .the two forms — both owed

| form | shape | means |
|---|---|---|
| latest | `openrouter/{author}/{tier}/latest` | the current model of that tier |
| bare | `openrouter/{author}/{tier}` | shorthand for `…/latest`, identically |

`LATEST_BY_BARE_SLUG` maps each bare name to exactly `${bare}/latest`, so one re-aim in
`PINNED_BY_LATEST_SLUG` re-aims both names.

## .the atom keeps the name it was built from

`genBrainAtom` sets `atom.slug` to the name it was given. the description names the pin it
reaches (`openrouter/deepseek/flash -> openrouter/deepseek/deepseek-v4.1-flash`), so a reader
still sees the weights.

## .the same law binds every listed name

pinned, versionless, and listed filtered slugs alike. three guards hold it:

| guard | what it closes |
|---|---|
| **the registry is DERIVED** — `getAllAtomSlugs().map(genBrainAtom)` | a name added to any slug map is selectable by construction |
| **the atom keeps its name** — `slug: input.slug`, never the pin | a renamed atom is one no consumer can find |
| **a LITERAL clamp** — `SLUGS_PROMISED_FOREVER` | a derived check agrees with a map that lost a row; a literal list does not |

🔴 **a pin openrouter withdraws keeps its atom.** its choice still resolves, and its ask fails with
`getOneWithdrawnModelError`, which offers live ids — never the bare "brain not found" of an absent
name. openrouter dates each withdrawal on its catalog (`expiration_date`), so no hand-kept map
records it.

⚠️ **the bound — unlisted ids.** an unlisted id (`openrouter/acme/new-model`) is accepted and is
**not** in the registry, by design: the set of openrouter ids is open. it is reached by
`genBrainAtom({ slug })` until rhachet can route a choice to a pattern.

## .when it fires

| when… | then… |
|---|---|
| you add a pin, a tier, or a listed filtered slug | add it to its map AND to `SLUGS_PROMISED_FOREVER` |
| openrouter dates a pin a tier names | re-aim the tier; the pin and its atom stay |
| you would remove a name from `SLUGS_PROMISED_FOREVER` | 🔴 forbidden. the list only grows |
| you would rename an atom to the model it reaches | 🔴 forbidden. put the pin in the description |
| you would hand-list atoms in `getBrainAtomsByOpenRouter` | 🔴 forbidden. derive them |
| a consumer reports a name "not accessible" | choose it through `genContextBrain`, never `genBrainAtom` |

## .enforcement — mechanized

`getBrainAtomsByOpenRouter.unit.test.ts` fails if:

- any key of `PINNED_BY_LATEST_SLUG` or `LATEST_BY_BARE_SLUG` is absent from the registry
- the registry differs from `SLUGS_PROMISED_FOREVER`
- a versionless atom's spec differs from the pin it reaches

`index.unit.test.ts` fails if `genBrainAtom` renames a versionless atom to its pin.

- a listed slug accepted by `genBrainAtom` and absent from the registry = **blocker**
- an atom whose `slug` is not the name it was built from = **blocker**
- a bare slug that maps anywhere but `${bare}/latest` = **blocker**
- a registry kept by hand rather than derived from the slug maps = **blocker**
- a name removed from `SLUGS_PROMISED_FOREVER` = **blocker**

## .see also

- `rule.require.versionless-slug-per-tier` — WHICH generics are owed
- `rule.always.verify-model-ids-by-live-call` — a re-aim still owes a live probe
