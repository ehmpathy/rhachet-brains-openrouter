# F09 — ask options under their own context key, `brain.ask.openrouter`

- **fork:** (a) beside `creds` in `brain.supplier.openrouter` · (b) their own key,
  `brain.ask.openrouter`, built by an exported `genContextOpenRouterAsk` · (c) ask rhachet to
  deep-merge supplier contexts
- **taken:** (b). rhachet binds the choice atom to `{ 'brain.supplier.openrouter': { creds } }`
  (`genContextBrain.js:52-56`) and merges a caller context shallow (`asBrainAtomWithContextBound.js:19`).
  under (a), the caller's entry replaces the bound one, so every ask must carry creds again. (b)
  merges beside them, untouched
- **rework:** clean. a key name and one helper
- **confidence 70%, why low:** the key name `brain.ask.<supplier>` is coined here. no rhachet
  convention names a per-ask key. a sibling supplier (anthropic, xai) may want the same shape,
  which argues for (c) upstream in the long run
- **where:** `1.vision.yield.md` .the contract, .what is awkward
- **verdict:** retired, 2026-10-07: no ask option rides the context any more (F01 ruled (c)), so no second context key is minted
