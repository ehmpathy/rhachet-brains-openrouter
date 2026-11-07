# F34 — the leaves take the thought facts, never the wire shape

- **fork:** `getAllQualifiedEndpoints` and `getOneReplyDefectError` take `tokensThoughtBudget`
  and `thoughtLevel` · they take `reasoning: OpenRouterReasoning | null` and cast it each
- **taken:** the facts. the cap enters the supply once, as `reasoning`; the supply casts it once
  into the two facts the leaves read. each leaf then reads a plain number or a plain level, with
  no knowledge of openrouter's body key
- **rework:** clean — two signatures and their tests
- **confidence 70%, why low:** a direct caller of either leaf could pass both facts at once, a
  state `reasoning` cannot express. only the supply calls them today
- **where:** `getOneSuppliedCompletion.ts`, `getAllQualifiedEndpoints.ts`, `getOneReplyDefectError.ts`
- **verdict:** —
