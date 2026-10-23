# F6 — the 404 cache drop stays inside the send, under its `getOne*` name

- **fork**: the admitted-set send drops the model's cached endpoint list on a 404 (the vision's "drop the cache on a 404"). where does that drop live? (a) inside `getOneAdmittedSetCompletion`, as the floor walk already does, with a `.note` on the header · (b) split out to the caller (`getOneSuppliedCompletion`), which would then need the fault the send swallowed · (c) rename both sends (`getOneFloorCompletion`, `getOneAdmittedSetCompletion`) to a verb that admits the write
- **taken**: (a). one rule on both paths: the floor walk drops the cache inline, and has since before this tree. (b) on one path alone splits one rule in two; (b) on both reshapes the floor walk's contract, outside a p0 scope. the drop is an idempotent cache invalidation, never a domain write: a concurrent read that lands after it misses and refetches, the same as a cold cache
- **rework**: clean — each send has one caller (`getOneSuppliedCompletion`); a rename or a split is local
- **confidence**: 80% — the hazard rule reads a `get` that writes as a blocker; the write here is a cache drop, which may or may not count
- **where**: `getOneAdmittedSetCompletion`, `getOneFloorCompletion`
- **raised by**: 5.1 peer `arch-hazards-behavior`, i001 blocker.1
- **verdict**: —
