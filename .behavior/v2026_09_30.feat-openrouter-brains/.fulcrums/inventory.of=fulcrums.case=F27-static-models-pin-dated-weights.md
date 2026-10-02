# F27 — each static model pins its dated weights; route reads stay on the listed id

- **fork**: (a) keep the listed ids, and record "no dated peer" · (b) re-pin `model` to the dated
  `canonical_slug` everywhere · (c) two ids per model: `weights` (dated, sent on each ask) and
  `model` (listed, for the endpoint, zdr, and catalog reads)
- **taken**: (c).
  - openrouter lists no dated id as an `id`, but each id carries a dated `canonical_slug`, and
    all five answered a live chat completion on 2026-10-02 (`rule.always.verify-model-ids-by-live-call`)
  - the listed id is a movable alias, measured: `deepseek/deepseek-v4-pro` names the 20260423
    weights, `deepseek/deepseek-v4-pro-0813` the 20260813 ones. so (a) fails
    `rule.require.pin-explicit-model-ids`
  - (b) breaks `privacy=full`: the zdr list keys its rows by the listed id only, so a dated id
    matches no endpoint, and every private route would find none. measured on the same day
  - the slugs do not change; the pin is internal (`rule.require.versionless-slug-per-tier`)
- **gap**: if openrouter re-aims a listed id, the route reads describe hosts of weights we no
  longer send. `BrainAtom.config` integration case5 fails loud that day; the fix is a decision
- **rework**: clean — one config field, one target field, one request line.
- **confidence**: 80% — openrouter accepts a `canonical_slug` as a request model today, but does
  not document it as a contract.
- **where**: `BrainAtom.config.ts`, `asAtomTarget.ts`, `genBrainAtom.ts`.
- **raised by**: repo-rules, i002 nitpick.1.
- **verdict**: —
