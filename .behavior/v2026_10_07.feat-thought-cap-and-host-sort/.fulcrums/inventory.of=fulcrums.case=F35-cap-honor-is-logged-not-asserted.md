# F35 — a host's cap honor is logged per draw, not asserted

- **fork:** integ [case6] asserts each host's cap honor against a measured table
  (`HONORS_CAP_BY_PROVIDER`) · it asserts only what the package owes (the budget reaches the
  host, the thought is reported) and logs each host's draw
- **taken:** log, not assert. the table flipped both ways inside one afternoon (2026-10-21):
  Relace ("honors") thought past 600 under a budget of 400; a host marked "ignores" stayed under
  400. a host's honor is a draw, not a property, so the assertion tested openrouter's hosts
- **what the change gives up:** a red test the day a host's honor shifts. the log line
  (`thought cap draw { slug, provider, budget, tokensThought, ignored }`) keeps it measurable,
  but naught fails on its values. its shape is snapped, with provider, tokensThought and ignored
  masked (`the logged draw, live values masked, matches snapshot`), so a change to what the draw
  reports shows in review
- **what still holds:** the package's own judgment on an overrun (`isThoughtCapIgnored`, and the
  all-thought fix that names a host that ignored its cap) is unit-tested apart from the draw
- **rework:** clean — restore the table and its `then`; or assert a rate over N draws, which
  costs N live asks per tier
- **confidence 75%, why not higher:** this narrows what a test asserts, which the 5.3 gate says
  needs the wisher's approval. the wish's own line is "each reply reports the thought tokens it
  spent, so a caller can size its cap from data", which the test still asserts
- **where:** `genBrainAtom.effort-and-sort.integration.test.ts` [case6]
- **verdict:** — (for the wisher)
