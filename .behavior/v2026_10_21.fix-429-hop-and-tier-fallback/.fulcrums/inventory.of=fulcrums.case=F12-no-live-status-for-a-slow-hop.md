# F12 — no live status while a hop waits; it shows after, in `supply.attempts`

## .the fork
1. **defer** — ship the hop with status after the fact (`supply.attempts`), and catch a dream to
   add an optional `log` to the supplier context
2. **add now** — thread an optional `log` through `brain.supplier.openrouter` into the supply
   path, and log each hop as it happens

## .taken: 1 (defer), and why at the time
found in 5.3 self review `has-critical-paths-frictionless`, on the rubric line "visible status
throughout". fork 2 adds a context dependency to the public `brain.ask` contract; that ripples into
the readme, the context type, and every caller — not clean inside a p0 cut scoped to the host-400
step and the 429 hop. the floor walk already waited silently before this PR, so the gap is not new.

## .rework: clean
an optional context field and one log call per hop. no caller breaks; no stored shape changes.

## .confidence: 75%, and why it is low
a reviewer could fairly read a silent wait of up to ~2 minutes as friction this PR enlarges (a
second path now waits). the wisher's scope cut argues defer; the frictionless rubric argues add.

## .where
`src/domain.operations/supply/getOneAdmittedSetCompletion.ts`, `getOneFloorCompletion.ts`;
dream `.dream/v2026_10_21.observe.hop-status-while-it-waits.md`

## .verdict
open — for the council
