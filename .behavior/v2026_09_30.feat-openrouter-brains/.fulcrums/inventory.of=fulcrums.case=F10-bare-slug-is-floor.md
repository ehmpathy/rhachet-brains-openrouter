# F10 — a bare slug walks cheapest-first

- **fork**: (a) a bare slug sends no `provider` — openrouter's balancer picks · (b) a bare slug =
  `floor` over every healthy endpoint · (c) `floor` plus a default speed bar.
- **taken**: (b).
- **why**: (a) is what the package did on 2026-10-01; it cost 1.4–4.9× the cheapest healthy host
  and picked AtlasCloud, which is off the zero-retention list. the wisher: "we should have gotten a
  cheaper one." (a) also cannot be proven — no pinned endpoint, so no check gates the answer.
- **against (b)**: the 2nd cheapest endpoint of v4.1-flash runs at 7 tok/s p50. a bare slug may
  land there.
- **against (c)**: any default bar is a number nobody asked for.
- **rework**: clean — one default in the slug parser.
- **confidence**: 70%.
- **where**: yield §what a bare slug promises.
- **verdict** (wisher, 2026-10-01): (b) rejected, (a) taken. a bare slug uses openrouter's
  balancer, as today; `floor` is the one-word opt-in to our walk.
