# F39 — `sort=throughput` under floor ranks by speed alone, price only as a tiebreak

- **fork:** under `floor&sort=throughput` the walk ranks fastest first, price only a tiebreak ·
  it ranks fastest first only among hosts within a bound of the cheapest qualified rate (e.g. 2×)
  · the listed throughput slug carries a `price.max` · the readme warns and points cost-minded
  callers to `speed=min{N}tps`
- **taken:** speed alone (`getAllQualifiedEndpoints.ts`, `asVerdictComparator`:
  `bySpeed || byCost`). the listed slug
  `openrouter/deepseek/flash/floor&speed=min50tps&privacy=full&sort=throughput` has no price cap
- **why at the time:** `sort=throughput` mirrors openrouter's own `provider.sort: 'throughput'`,
  which also ranks by speed alone; one word, one sense, under floor and without it
- **the cost it carries:** measured on `deepseek/flash`, the qualified hosts span `$0.0239/M`
  (open-inference, fp4) to `$0.6/M` (baseten/fast), ~25× on input. a caller who reads "floor" as
  "the cheap one" can land on the 25× host
- **rework:** clean. the ruling keeps the code as is, so the listed slug (promised forever via
  `SLUGS_PROMISED_FOREVER`) needs no new name
- **confidence 60% at the time, why low:** raised by the wisher's question after the stone passed
  ("would floor&sort=throughput give us the most expensive brains?"); the call was made for
  symmetry with openrouter, not against a cost bound
- **where:** `getAllQualifiedEndpoints.ts` (`asVerdictComparator`), `slug/AtomSlug.filtered.ts`
  (the listed slug), readme (already states "tries the fastest first for `throughput`")
- **verdict:** ruled by robot:director, 2026-10-23 — keep as taken. `sort=throughput` ranks by
  speed alone, as the name says; price stays the job of the extant `sort=price`; the floor is a
  filter, not a rank. no code change
