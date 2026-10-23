# F14 — the refusal's new lines say "host"; its extant headline and rows say "endpoint"

## .the fork
1. **host in the new lines** — `last host fault:` and the `fix:` line say "host", as the readme
   § host faults does; the extant headline (`no endpoint … served`) and attempt rows keep "endpoint"
2. **one word across the message** — rename the extant headline and rows to "host", or the new
   lines to "endpoint", so a reader of one refusal meets one word

## .taken: 1 (host in the new lines), and why at the time
raised by 5.3 peer lane r11 (enroll-verif-snapshot-blemishes, nitpick.4, i008). the new lines name
openrouter's own fault class: the `provider_name` metadata marks a *host* error, and
the readme, the wish, and #21 all say "host fault". the extant headline says "endpoint" because
the walk ranks endpoints (one provider may own several, vision row c16). a rename of the extant
headline and rows changes a message every caller and snapshot already reads, which is a contract
change outside the p0 cut (wish: "one seam, one clamp each"). the two words name two real things —
the ranked row (endpoint) and the party that faulted (host) — so the message is legible, if not
uniform.

## .rework: clean
a sedreplace over the render and its snapshots; no logic change.

## .confidence: 75%, and why it is not higher
`rule.forbid.ambiguous-labels` asks one word per concept, and a reader may take "host" and
"endpoint" for one concept here. if the council does, option 2 is the fix.

## .where
`src/domain.operations/supply/getOneFloorExhaustedError.ts` and the refusal snapshots

## .verdict
open — for the council
