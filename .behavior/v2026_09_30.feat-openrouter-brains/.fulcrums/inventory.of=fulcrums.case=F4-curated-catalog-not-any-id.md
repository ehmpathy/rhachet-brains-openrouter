# F4 — curated typed catalog, not any id

- **fork**: (a) a curated `CONFIG_BY_ATOM_SLUG` of live-probed openrouter ids, typed union ·
  (b) accept any `author/model` string; read context + rates from the endpoints api at ask time
- **taken at the first pass**: (a). `BrainAtom` needs a `spec` at construction (sync); the
  registry needs a finite list; the repo rules demand a live probe per id.
- **rework**: dirty — (b) changes the slug type from a union to a template string.
- **verdict**: (a) rejected — wisher ruled 2026-10-01: "an important requirement to eliminate
  the need for constant updates." a new openrouter model must be reachable with no edit and no
  release of this package.
- **constraint on the verdict** (rhachet@1.48.0, read 2026-10-01): `asBrainsFromPackageExports`
  keeps a `getBrainAtomsBy*` result only if it is a sync array; `genContextBrain` matches
  `choice` exactly (`genContextBrain.js:79,92,103`); `BrainAtom.spec` is static.
- **mechanism, per the wisher 2026-10-01**: publish both —
  - a **wildcard** atom `openrouter/*/*/*`, which binds any id + filters on demand;
  - a short **static** set we support long-term (F13), each with a filter pattern
    `openrouter/{family}/{tier}/*`.
  rhachet routes a choice to a pattern once the reseed lands:
  `dreams/v2026_10_01.reseed.rhachet-wildcard-brain-dispatch.md`. the wildcard ships in v1 for
  forward compat; until the dispatch, it serves via direct `genBrainAtom`.
- **spec for a bound wildcard atom**: static package defaults, since `spec` is built with no
  read (F17); no default cap — a bound applies only where the caller writes `price.max`, sent
  as `max_price` (F12, F17 verdict); true cost per response from `usage.cost`.
