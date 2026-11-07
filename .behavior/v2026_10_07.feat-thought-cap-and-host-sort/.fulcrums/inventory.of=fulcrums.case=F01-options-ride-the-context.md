# F01 — per-ask options ride the context

- **fork:** (a) the per-ask context · (b) slug words, e.g. `…/flash/thought=6000tok&sort=throughput`
  · (c) new fields on `ask` input, which needs a rhachet change
- **taken:** (a). the wish says "per ask". rhachet's `ask` input is fixed (`BrainAtom.d.ts:64`).
  the second arg reaches the atom on bhrain's path, `choice.ask(input, contextCaller)`, merged by
  `asBrainAtomWithContextBound.js:19`. the key it rides under is F09
- **rework:** clean. one read site in `genBrainAtom` and one exported helper; no caller is
  hardened yet
- **confidence 70%, why low:** bhrain's `choice` is typed with an `Empty` context (q4), so the
  call may need a type widen in rhachet. (b) needs no type change at all, but it mints an atom
  name per cap value
- **where:** `1.vision.yield.md` .the contract
- **verdict:** ruled by the wisher, 2026-10-07: (c). thought rides rhachet's generic `effort` on the ask (ehmpathy/rhachet#595), patched here until it releases (F10). sort moved to the slug (F02)
