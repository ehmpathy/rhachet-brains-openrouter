# F5 — filtered slugs reach the registry via a pattern per static slug

- **fork**: (a) the registry lists stock slugs; a consumer adds each filtered atom via
  `genBrainAtom` · (b) a fixed preset set (e.g. `/floor` per model) · (c) a pattern atom per static
  slug (`openrouter/deepseek/flash/*`) plus the wildcard (`openrouter/*/*/*`), dispatched by rhachet.
- **taken at the first pass**: (a), plus a reseed toward a rhachet hook.
- **taken now**: (c), shipped in v1; (a) remains the path until rhachet dispatches patterns.
- **why**: the wisher: "publish an openrouter/{manufacturer}/{model}/{filters} where manufacturer
  can be * and model can be * … expect that rhachet will know to route brains to it". filter
  combos are unbounded, so only a pattern lets the registry hold every name
  (`rule.require.versionless-slugs-selectable`).
- **rework**: clean.
- **confidence**: 70% — depends on the reseed's shape
  (`dreams/v2026_10_01.reseed.rhachet-wildcard-brain-dispatch.md`).
- **where**: yield §what we publish, case=6, case=20.
- **verdict**: —
