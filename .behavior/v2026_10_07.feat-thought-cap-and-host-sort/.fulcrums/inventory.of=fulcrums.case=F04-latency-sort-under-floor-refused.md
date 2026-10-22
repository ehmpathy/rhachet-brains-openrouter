# F04 — `latency` sort under `floor`: refused in this tree, until the latency figure is parsed

- **fork:** refuse now, with a fix that names `throughput` or a slug with no floor · parse
  `latency_last_30m` here and order by it · drop `latency` from the union in this tree
- **taken:** refuse now. the endpoints api reports `latency_last_30m` per host (read 2026-10-07),
  but `OpenRouterEndpoint` does not carry it, and the latency tree's wish is to read exactly that
  figure. if both trees parse it, they collide on one domain object
- **rework:** clean. once the field lands, the refusal becomes a comparator
- **confidence 65%, why low:** an earlier draft of this entry said "no latency figure exists".
  the live read proved that false. the refusal now rests on tree order alone, and if the latency
  tree merges first it is never needed
- **where:** inventory row `latency × floor × alone`; yield q5
- **verdict:** —
