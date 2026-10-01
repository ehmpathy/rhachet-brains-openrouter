# rule.require.versionless-slugs-selectable

## .what

every versionless slug is **exported as its own atom, under its own name** — in the same
registry, beside the pin it reaches today.

```
getBrainAtomsByFireworksAI()
  fireworks/deepseek/flash           # bare      — the same brain…
  fireworks/deepseek/flash/latest    # latest    — …the same brain…
  fireworks/deepseek/flash/v4.1      # pinned    — …the same brain
```

one brain, three names, three atoms. each atom carries the name it was exported under as
`atom.slug`, and the spec of the pin it reaches.

## .why — a name a consumer cannot SELECT is a name that does not exist

a consumer never calls `genBrainAtom`. it registers `getBrainAtomsByFireworksAI()` and then
names a `choice`, which is matched against `atom.slug`. so:

| the name is | in the type union | in the registry | a consumer can choose it |
|---|---|---|---|
| accepted and exported | ✔ | ✔ | ✔ |
| accepted, **not** exported | ✔ | ✘ | 🔴 **no** — the union lies |

⇒ acceptance by `genBrainAtom` proves naught. **the registry is the contract**, because it is
the only surface a consumer selects from.

**measured 2026-09-26.** v0.2.0 shipped every `/latest` slug in the type union and in
`genBrainAtom`, and left all of them out of the registry "to avoid duplicates". worse, the atom
renamed itself to the pin it reached. so `choice: 'fireworks/deepseek/flash/latest'` failed with
the full available list printed beside it, and not one versionless name in it. the names
`rule.require.versionless-slug-per-tier` exists to offer were the names no consumer could pick.

## .the two forms — both owed

| form | shape | means |
|---|---|---|
| latest | `fireworks/{family}/{tier}/latest` | the current model of that tier |
| bare | `fireworks/{family}/{tier}` | shorthand for `…/latest`, identically |

the bare form is derived from the latest union, and `LATEST_BY_BARE_SLUG` maps each to exactly
`${bare}/latest`. so one re-aim in `PINNED_BY_LATEST_SLUG` re-aims both names.

## .the atom keeps the name it was built from — every form

`genBrainAtom` sets `atom.slug` to the name it was given — versionless, pinned, legacy, or
retired. a renamed atom is one no consumer can select by the name they hold. the description
names the pin it reaches (`fireworks/deepseek/flash -> fireworks/deepseek/flash/v4.1`), so a reader
still sees the weights. ⇒ the same law for legacy and retired names:
`rule.require.redirected-slugs-selectable`.

## .enforcement — mechanized

`getBrainAtomsByFireworksAI.unit.test.ts` fails if:

- any key of `PINNED_BY_LATEST_SLUG` or `LATEST_BY_BARE_SLUG` is absent from the registry
- the registry differs from every accepted name (it is derived from the slug maps)
- a versionless atom's spec differs from the pin it reaches

`index.unit.test.ts` fails if `genBrainAtom` renames a versionless atom to its pin.

- a versionless slug accepted by `genBrainAtom` and absent from the registry = **blocker**
- a versionless atom whose `slug` is not the name it was built from = **blocker**
- a bare slug that maps anywhere but `${bare}/latest` = **blocker**
- a generic added to a registry map with no registry entry = **blocker** (the test catches it)

## .see also

- `rule.require.versionless-slug-per-tier` — WHICH generics are owed; this rule says each must be
  selectable
- `rule.require.redirected-slugs-selectable` — the same law for legacy and retired names
- `rule.always.verify-model-ids-by-live-call` — a new alias reaches an extant pin, so it needs no
  new probe; a re-aim still does
