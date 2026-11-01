# F26 — a plain-string ask that ends `stop` with 0 chars after thought still passes

- **fork:** pass it, as 0.1.3 does · name it all-thought where thought > 0 · name it only where
  the ask carried a cap
- **taken:** pass it. a `z.string()` reply may be '' on purpose, and q2 measured no host that
  ends an all-thought reply with `stop`; each such reply ended `length`, which is named
- **rework:** clean — one clause in `getOneReplyDefectError`
- **confidence 70%, why low:** q2 probed two hosts. a host that ends a spent reply with `stop`
  would hand a capped plain-string ask an empty success
- **where:** `getOneReplyDefectError.ts`
- **verdict:** —
