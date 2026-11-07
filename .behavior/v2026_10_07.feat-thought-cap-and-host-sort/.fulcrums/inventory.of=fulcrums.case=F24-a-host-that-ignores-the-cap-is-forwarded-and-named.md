# F24 — a host that ignores the thought budget is still served, and named only if it runs dry

- **fork:** forward the budget and serve the host either way · step past a host whose thought
  overran the budget, as a host failure · drop hosts known to ignore the cap before spend
- **taken:** forward and serve. measured 2026-10-21, two asks per budget of 300 · 600 · 1200 ·
  2400 on a thought-heavy prompt: deepseek flash (Relace) thought 179–489, under every cap; z-ai
  flash (OpenInference) thought 875–1218 whatever the cap. the glm answers were correct. a step
  past would discard a sound, paid answer and pay again. where the overrun empties the reply, the
  all-thought error names the host, not a lower budget
- **rework:** clean — the overrun is already measured per reply (`tokens.thought` against the
  budget × 1.5 slack); a step or a 7-day mark is one clause in `asHostFailure`
- **confidence 65%, why low:** a caller who set a cap to bound spend pays past it on glm, with
  only the metric to tell them. the wisher may want that host dropped or marked
- **where:** `genBrainAtom.effort-and-sort.integration.test.ts` [case6] pins each tier's measured
  state; `readme.md` names it
- **verdict:** —
