# F12 — `price.max`, sent as `max_price` only when written

- **fork**: (a) no price filter; spec cost is an estimate · (b) every ask sends `max_price` = the
  spec cost cap (F17), and a caller may tighten it with `price.max=…`.
- **taken**: (b).
- **why**: the wisher asked how a caller lives with a range of prices. measured: 23× on prompt
  rate across 33 endpoints of one model. `max_price` is hard: an impossible bound returned 404
  `No endpoints found that satisfy the max price` before any spend (probe 1). so `spec.cost` can
  be a true upper bound, enforced by openrouter, not a guess.
- **open**: the unit form (`price.max=0.5usd/M` vs a split prompt/completion bound).
- **rework**: clean.
- **confidence**: 80%.
- **where**: yield §the price range, case=23.
- **amended by F17's verdict (2026-10-01)**: the "on every ask" half fell — no default cap.
  `max_price` is sent only when the caller writes `price.max`. what stands is the filter word
  itself. who asked: the wisher, on how a caller lives with a 23× range; floor answers "cheapest",
  `price.max` answers "never above X", which floor alone cannot promise once a speed or privacy
  word pushes the pick up the list.
