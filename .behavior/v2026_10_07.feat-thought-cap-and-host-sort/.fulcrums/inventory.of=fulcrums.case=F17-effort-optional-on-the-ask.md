# F17 — `effort?` stays optional on the atom ask

- **fork:** `ask({ ..., effort?: BrainEffort })` as rhachet#595 declares it · `effort: BrainEffort | null`,
  required, per `rule.forbid.undefined-inputs`
- **taken:** optional. `genBrainAtom`'s `ask` is the public `BrainAtom.ask` contract that rhachet
  declares and every consumer calls through `genContextBrain`; its shape is rhachet's, not ours.
  a required `effort` would fail `implements BrainAtom` and break every caller that sets none.
  the rule's own exception covers a user-faced boundary contract. inside, the first line folds it:
  `asReasoningRequest({ effort: input.effort ?? null })`, so no internal input sees `undefined`
- **rework:** clean. if rhachet ever requires `effort`, the `?` goes and naught else moves
- **confidence 90%, why:** the shape is fixed by the peer dependency, not chosen here
- **where:** `src/domain.operations/atom/genBrainAtom.ts`
- **verdict:** —
