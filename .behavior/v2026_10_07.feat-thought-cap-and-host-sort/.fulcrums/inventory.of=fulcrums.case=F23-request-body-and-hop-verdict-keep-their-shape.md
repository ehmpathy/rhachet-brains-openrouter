# F23 — the request body stays inline in `ask`, and the hop verdict keeps `response | error`

- **fork:** a pure `asChatRequest` transformer, and a hop verdict with a `kind` · the extant
  shapes
- **taken:** the extant shapes. the body was assembled inline in 0.1.3; this change adds one
  conditional spread (`reasoning`) beside the two it found. the "unset sends the 0.1.3 body"
  promise is proven where it matters, at the sdk boundary, by the integration spy on
  `Completions.prototype.create`. `getOneHopVerdict` is file-local to the walk, and its one
  reader branches on `failure` first
- **rework:** clean — both are pure moves, no caller outside their file
- **confidence 75%, why:** a transformer would let a unit snapshot clamp the body; that is a
  better test seat, but the refactor of the 0.1.3 body sits outside this change's scope
- **where:** `genBrainAtom.ts`, `getOneFloorCompletion.ts`
- **verdict:** —
