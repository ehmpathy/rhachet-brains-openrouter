# F06 — the all-thought error is a `MalfunctionError`

- **fork:** `MalfunctionError` (exit 1), beside its reply-defect peers · `ConstraintError`
  (exit 2), since the caller fixes it with a cap · a named subclass a caller can `instanceof`
- **taken:** `MalfunctionError`, with the evidence (`thoughtTokens`, `outputTokens`, `cap`)
  in its metadata. a caller that wants to branch reads the metadata
- **rework:** clean. one class name at one throw site
- **confidence 60%, why low:** bhrain may want to catch it by class to retry with a lower cap.
  a named subclass would serve that better
- **where:** case=2
- **verdict:** —
