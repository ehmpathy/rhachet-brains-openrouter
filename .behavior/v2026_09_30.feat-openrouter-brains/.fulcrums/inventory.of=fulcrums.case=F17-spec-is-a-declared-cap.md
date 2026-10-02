# F17 — `spec` is a declared cap, never a live read

- **found**: self review `has-questioned-requirements`. the vision promised `spec.cost` = "the
  priciest endpoint in the qualified set". rhachet's `BrainAtom.spec` is "the static
  specification the supplier guarantees" (`rhachet@1.48.0 BrainAtom.d.ts:51`), and
  `genBrainAtom` sets it from config at build, with no await (`genBrainAtom.ts:93`). a live read
  cannot feed it.
- **fork**: (a) make `genBrainAtom` async and read endpoints at build — breaks rhachet's sync
  registry (`asBrainsFromPackageExports` keeps only sync arrays) · (b) `spec` = a declared cap,
  enforced per ask via `max_price`; the live set decides the route · (c) `spec.cost` = 0 / unknown.
- **taken**: (b).
  - static slug: the cap declared in `BrainAtom.config.ts`; `price.max` lowers it. the static
    catalog probe asserts each cap ≥ every live endpoint rate, so a new pricier endpoint fails
    loud rather than silently drops out.
  - wildcard: `price.max` if set, else a **package default cap**; the context window likewise
    a package default, and the live `context_length` of the pinned endpoint governs the ask.
- **open**: the default cap's value. best guess: the priciest prompt and completion rate among
  the static set, ×2 — high enough that most models serve, low enough that an unknown model
  cannot bill wild rates unseen. a model priced above it refuses before spend and names
  `price.max` as the fix.
- **why (c) loses**: rhachet's budget math reads `spec.cost`; a zero lies to every caller that
  plans spend.
- **rework**: clean — the default is one constant; the cap mechanism is F12's `max_price`.
- **confidence**: 70% on the mechanism, 50% on the default's value.
- **where**: yield §the price range; case=20, case=23, case=5.
- **verdict** (wisher, 2026-10-01): no default cap — "if they want capped prices, they'll
  specify via filters." so `max_price` is sent only for `price.max`, and `spec.cost` is an
  **estimate**, not a bound: static slugs carry the model's typical rate from config; an id that
  reaches us via the declared pattern `openrouter/*/*/*` carries its catalog rate if rhachet's
  hook can await (Q26), else a labelled placeholder. the static probe now asserts each estimate
  lies within its model's live rate range.
