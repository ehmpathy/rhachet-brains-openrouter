# F3 — a host 400 reuses outcome `failed`, no new word

- **fork**: (a) record a host 400 as `failed` and widen its note to "the host failed this ask" · (b) add a new outcome (`rejected`, `errored`)
- **taken**: (a). `failed` already means a host failed this ask with no cache drop; a 400 that names the host is the same event at a different status. a new word would sit next to `refused` and read as its synonym (`rule.forbid.term.addition.synonym`)
- **rework**: clean — add an outcome value and one branch in `asHostFault`
- **confidence**: 85%
- **where**: `src/domain.objects/FloorAttempt.ts`, `asHostFault`
- **verdict**: —
