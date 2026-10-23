# F1 — the shared host-fault seam with feat-thought-cap-and-host-sort

- **fork**: (a) one transformer `asHostFault({ error })` in `src/domain.operations/supply/asHostFault.ts`, called by both supply paths; thought-cap adds its transport rows (cut body, stall) to it · (b) wait to read the thought-cap vision and adopt its name
- **taken**: (a). the wish orders one named transformer; the thought-cap branch is unreachable (`origin` holds only `main`, checked 2026-10-21 via `gh api --method GET .../branches`), and the release is today
- **rework**: clean — a rename or a merge of two rows sets into one file; the second tree to land rebases
- **confidence**: 80% — the name and the input shape (`{ error }`) are a guess; thought-cap may want `{ error, response }` to read a cut body. a widened input is additive
- **where**: `1.vision.yield.md` § the contract
- **verdict**: —
