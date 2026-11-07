# F27 — the walk's host verdict and the post-walk defect error stay two reads of a reply

- **fork:** one `asReplyKind` that both the walk and the defect error map from · two reads, each
  with the predicate its own question needs
- **taken:** two reads. they answer two questions: the walk asks "did this host fail, so another
  may serve?" (`asHostFailure`), and the defect error asks "what is wrong with the reply that
  ended the walk?" (`getOneReplyDefectError`). the predicates differ on purpose: `empty` steps
  only on `stop`, since a `length` reply is never a host failure; the defect error checks
  `length` first, so an empty `length` reply is named all-thought before `empty` is reached. both
  read one json rule (`isJsonText`)
- **rework:** clean — the two share their leaves already; a shared kind is one more transformer
  with two maps
- **confidence 70%, why low:** `prose`, `empty` and `failed` name a kind in two enums
  (`FloorAttempt.outcome`, `metadata.defect`), so a new kind is added twice. and one case parts
  them (r011 i006): a json reply that ends `content_filter` with 0 chars is not stepped past, so
  the ask ends in the `empty` error with hosts left untried. low harm: a filter verdict on one
  host likely holds on the next for the same prompt
- **where:** `asHostFailure.ts`, `getOneReplyDefectError.ts`
- **verdict:** —
