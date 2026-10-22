# F19 — fakes and comparators keep the positional shape their third-party contract fixes

- **fork:** named `(input)` args everywhere · the positional shape the caller fixes
- **taken:** positional where the shape belongs to someone else. a fake of
  `openai.chat.completions.create(body, options)` must match the sdk's two-argument signature, or
  it fakes no sdk. `asVerdictComparator` returns the `(a, b) => number` that
  `Array.prototype.sort` calls; a named-args comparator cannot be passed to it. both carry a note
- **rework:** clean
- **confidence 90%, why:** the shape is the callee's contract, not a choice
- **where:** `getOneFloorCompletion.test.ts`, `getOneCompletionWithinBound.test.ts`,
  `getAllQualifiedEndpoints.ts`
- **verdict:** —
