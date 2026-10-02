# F14 — the proof blocks; only `region=usa` waits for the generation record

- **fork**: (a) hold every answer until the generation record confirms the endpoint · (b) gate on
  the response's `provider` field; audit the generation trail async · (c) no post-call check;
  trust `only` + no fallback · (d) gate every ask on `provider`; hold only `region=usa` answers
  for the generation record; no background work.
- **taken at first**: (b), 75%.
- **taken now**: (d) — overturned in self review `has-questioned-requirements`.
- **why (b) fell**: a library cannot rely on a background poll. a short-lived cli (a reviewer
  run) exits before the record lands ~11s on, so the audit never runs; or the poll holds the
  process open ~11s. "fails on the next ask from that process" assumes a next ask that a cli
  never makes. a proof that runs only sometimes is not a proof.
- **why (d), not (a)**: the generation record lags 10.7–16.6s (spike). every promise but region
  has a native openrouter filter as a second, independent enforcement — `quantizations` for
  precision, `zdr` for privacy, `max_price` for price — so the provider gate plus that filter
  suffices. region has none on our plan (Q16), and `fireworks` / `fireworks/us` share a provider
  name. so region alone pays the wait. the wisher asked to "strictly prove" usa; region asks are
  rare and already 17× the floor, so ~11s is a fair price.
- **rework**: clean — (a) or (b) is a flag away; if Q16 yields a native region filter, (d)
  collapses to the provider gate alone.
- **confidence**: 70% — the trade of ~11s per usa ask is a wisher call.
- **where**: yield §the promises, §latency; case=5, case=22.
- **verdict** (wisher, 2026-10-01): the ~11s region hold is rejected — "trust the pinned tag".
  what remains: every filtered ask still gates on the response `provider`, before return, with
  no wait. `region=usa` is trusted at endpoint grain within the pinned provider, and every
  answer carries `metrics.route.generationId` so an auditor can read the served `endpoint_id`
  later (the wisher said yes to that middle ground). no background work.
