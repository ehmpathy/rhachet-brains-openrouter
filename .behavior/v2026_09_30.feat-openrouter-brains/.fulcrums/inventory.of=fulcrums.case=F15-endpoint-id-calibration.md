# F15 — map `endpoint_id` to tag by calibration

- **fork**: (a) prove at provider-name grain only · (b) build an `endpoint_id → tag` map: one
  pinned call per endpoint, read its generation record, persist the pair; re-calibrate on an
  unknown id · (c) wait for openrouter to expose ids in the endpoints api.
- **taken**: (b), for endpoints a promise depends on (today: usa-tagged ones).
- **why**: the endpoints api lists no id (key list read 2026-10-01); the generation record names
  attempts only by `endpoint_id`. `fireworks` and `fireworks/us` are both "Fireworks", so (a)
  cannot prove `region=usa`.
- **risk**: ids may rotate. an unknown id triggers one re-calibration before the held answer is
  judged; still unknown → withheld. never a silent pass.
- **rework**: clean.
- **premise observed** (probe 5, 2026-10-01, `appendix/research.route-probe-5.v2026_10_01.json`):
  the mechanism needs `fireworks` and `fireworks/us` to carry distinct `endpoint_id`s. pinned
  live: `fireworks` → `834bf093-089a-4442-bc64-8adce8b83e39`, `fireworks/us` →
  `b69086f3-e5bb-4b57-a1c0-b507bc447ec8`. distinct. n=1 each; 4 of 6 asks hit 429
  (`upstream_provider_shared_pool`).
- **confidence**: 65% — premise seen once; id stability over time untested.
- **where**: yield §the promises (`region=usa`), Q15.
- **verdict**: moot, by F14's verdict (2026-10-01). the atom reads no generation record, so it
  needs no map. the probe-5 evidence stays: it shows a later audit by `endpoint_id` can work.
