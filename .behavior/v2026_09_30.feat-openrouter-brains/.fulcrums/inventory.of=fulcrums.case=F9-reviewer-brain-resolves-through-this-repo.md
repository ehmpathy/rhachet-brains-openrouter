# F9 — the route's reviewer brain resolves through this repo's own build

- **fork**: (a) before the swap lands, pin the reviewer brain to a **published**
  `rhachet-brains-fireworksai` (a devDependency at a fixed version, not `link:.`) · (b) point the
  guards at an openrouter slug from this package once it builds · (c) leave it, and accept that
  every guard malfunctions after the swap
- **taken**: (a). the guards must keep their verdicts readable through the swap itself, and (b)
  makes the package review its own half-built self.
- **rework**: clean — one devDependency line, or a guard brain flag.
- **confidence**: 70%. evidence: the i002 stack trace runs
  `dist/domain.operations/atom/genBrainAtom.js`; `package.json` holds
  `"rhachet-brains-fireworksai": "link:."`.
- **where**: execution, before the first `src/` rename.
- **verdict**: (b), by the wisher's act 2026-10-01 — "put us on this agreed
  floor&speed=min50tps&privacy=full", and dogfood it. the guards of 1.vision, 5.1, and 5.3 run
  `--brain 'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full'` through `link:.`. the
  cost named above is real and now owned: a broken `dist/` blinds every reviewer, so `npm run
  build` precedes each `--as arrived`.
