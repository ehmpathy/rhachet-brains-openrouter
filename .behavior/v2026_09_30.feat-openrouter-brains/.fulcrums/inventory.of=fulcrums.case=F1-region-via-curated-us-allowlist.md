# F1 — `region=usa`: usa-suffixed tags only, proven by endpoint id

- **fork**: (a) a dated, curated allowlist of providers believed us-hosted, base tags included ·
  (b) drop `region` from v1 · (c) route to `us.openrouter.ai` (business/enterprise) · (d) only
  endpoints whose **tag** names a usa region (`fireworks/us`), proven per call by endpoint id
  (F15) · (e) key-level `allowed_data_regions` (Q16).
- **taken at the first pass**: (a), 50%.
- **taken now**: (d), 75%. the wisher asked "how can we strictly prove that when someone says
  they want a usa based inference, they get it". (a) cannot: a provider's domicile is not its
  datacenter, so a base tag on a curated list is our claim, not evidence. (d) rests on the tag
  openrouter publishes, and the endpoint id the generation record names.
- **cost of (d), measured 2026-10-01**: one qualified endpoint for v4.1-flash (`fireworks/us`),
  at $0.45/M — 17× the floor — and it throttled 2 of 2 asks in probe 1.
- **the stronger answer**: (c) or (e), if openrouter enforces region itself. `GET /key` shows
  `allowed_data_regions: ["global"]` on this key; which values exist and on which plan is Q16.
  if (e) can be set per key, `region=usa` should require it and refuse otherwise.
- **rework**: clean — one filter's qualifier.
- **where**: yield §the promises, §requirement combinations, case=5.
- **verdict**: —
