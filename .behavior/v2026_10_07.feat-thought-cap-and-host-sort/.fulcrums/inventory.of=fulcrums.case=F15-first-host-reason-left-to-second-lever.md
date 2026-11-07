# F15 — the first-host reason field ships with the second lever, not with sort alone

- **fork:** ship `supply.choice.firstHost: 'sort'` now, as case=5's bound says · ship only
  `supply.choice.sort`, and let the tree that adds a second lever (the affinity pin, or the
  latency filter) add the reason field with its two values
- **taken:** ship only `sort`. with one lever the reason has one value, so it carries no
  information a reader lacks: `supply.choice.sort` already says the order. a field whose sole
  value is fixed is a promise with naught behind it
- **rework:** clean. the second-merged tree adds one field and its values; no caller reads a
  reason field today
- **confidence 70%, why low:** case=5 `.the bound` said this tree ships the field. the call
  departs from the vision's own text on a judgment of value, not on a constraint
- **where:** `src/domain.objects/SupplyChoice.ts`; `1.vision.experience.case=5.affinity-beats-sort.md`
- **verdict:** —
