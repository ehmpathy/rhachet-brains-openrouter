# F20 — the refusal tests cast an untyped caller's shape

- **fork:** cast each invalid `effort` to `BrainEffort` in the refusal test · drop the refusal
  tests, since the type already refuses those shapes
- **taken:** cast. `asReasoningRequest` refuses at runtime for callers the type cannot reach — js
  callers, a json config, a rhachet version skew. to prove that refusal, a test must hand in a
  shape the type forbids, and a cast is the only spelling of that in typescript. the cast is the
  test subject, not a gap in a type; it has no removal path because its purpose is permanent
- **rework:** clean
- **confidence 85%**
- **where:** `src/domain.operations/atom/asReasoningRequest.test.ts`
- **verdict:** —
