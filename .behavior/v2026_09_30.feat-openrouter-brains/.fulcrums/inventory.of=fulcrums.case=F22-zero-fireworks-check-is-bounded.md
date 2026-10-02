# F22 — the "zero fireworks" check is bounded to tracked files outside `.behavior/`

**fork:** (a) the wish's literal check — `rhx grepsafe --pattern fireworks` returns zero · (b) zero
hits in tracked files outside this route's `.behavior/` record; agent caches gitignored.

**taken:** (b). (a) cannot reach zero without a scrub of this route's own record: the swap is the
subject of the record, so the record names what was swapped. grepsafe also reads the session
history under `.agent/.actors/` and the rmsafe trash under `.agent/.cache/` — measured 2026-10-01,
both hit. those are not repo identity; they leave the check once gitignored.

**rework:** clean — one exemption in the identity clamp, or none.

**confidence:** 85% — the wisher wrote the literal command; the exemption is a read of intent
("zero fireworksai identity left"), not the words. asked as Q27.

**clamp:** case=8 — a unit test greps tracked files outside `.behavior/` and names any match.

**where:** yield § package identity; case=8

**verdict:** —
