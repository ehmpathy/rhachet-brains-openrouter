# F2 — `speed.min` as a hard filter on authenticated p50

- **fork**: (a) keep endpoints with `throughput_last_30m.p50 ≥ N`, send as `only` · (b) send
  `preferred_min_throughput: N` only — native, but soft · (c) both.
- **taken**: (a). (b) is moot: each call pins one endpoint (F3), so there is no set for openrouter
  to rank within.
- **evidence, 2026-10-01**: an authenticated read returns p50 on 32 of 33 endpoints of
  v4.1-flash; the first-pass `null` was the unauthenticated read (Q3). `null` stays excluded:
  unmeasured is not fast.
- **open**: p50 vs p90 for "≥ 50 tok/s"; p50 chosen as "typical". the window is 30 min and the
  cache adds up to 30 more (F16).
- **rework**: clean — swap the percentile.
- **confidence**: 80%.
- **where**: yield §the promises, case=2, case=4.
- **verdict**: —
