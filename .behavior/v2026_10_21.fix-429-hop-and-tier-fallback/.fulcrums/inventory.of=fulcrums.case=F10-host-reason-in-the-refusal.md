# F10 — the last host's own reason rides in the refusal message, cut to 300 chars

- **fork**: the host's reason (`metadata.raw`) can echo part of the caller's prompt. does the refusal show it?
  - (a) show it in the message and metadata, cut to 300 chars, with the host's error as `cause`
  - (b) keep it out of the message; leave it on `cause` alone
  - (c) show it only behind an opt-in flag
- **taken**: (a). a context overflow is the commonest host 400 a caller must act on, and its fix (shrink the request) is legible only from the host's words. without them the refusal tells the caller to retry what can never serve
- **why the leak is bounded**:
  - the message lands in the caller's own process and logs, which already hold the prompt the caller sent
  - zdr (`privacy=full`) governs what the provider retains; it says naught of the caller's own logs
  - the cut to 300 chars bounds any echo
- **rework**: clean — one line in `getOneFloorExhaustedError` drops the detail from the message; `cause` keeps it readable
- **confidence**: 80%
- **where**: `asHostFaultReason`, `getOneFloorExhaustedError`
- **raised by**: 5.1 peer `enroll-impl-behavior-intent`, i005 seventh point
- **verdict**: —
