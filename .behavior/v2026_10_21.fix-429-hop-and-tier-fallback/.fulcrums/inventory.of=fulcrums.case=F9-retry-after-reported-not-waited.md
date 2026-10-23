# F9 — openrouter's `retry-after` is reported, not waited on between hops; the client keeps its own retries

- **fork 1**: the wish says "honor `retry-after`". what does a hop do with it?
  - (a) report it: the hop re-sends to the other hosts at once, and the refusal names the wait (`fix: retry after Ns`)
  - (b) wait it out before each hop
  - (c) wait it out only before the refusal, then re-walk once
- **taken**: (a). the `retry-after` is the throttled host's clock; the next host is a different host with its own capacity, so a wait before it spends the caller's time for no gain. the openai client already honors `retry-after` on its own retries of the same send (2 retries, each waits up to 60s), before the hop sees the 429
- **fork 2**: cut the client's own retries on hop sends (`{ maxRetries: 0 }` while a hop remains)?
  - keep: a throttled host that asks for 30s costs about a minute before the next host is tried
  - cut: a faster hop, but no recovery from a transient 429, and a 5xx on a non-last endpoint loses its retry while 5xx is outside `asHostFault`
- **taken**: keep — decided by robot:director, best guess, 2026-10-21. #21 is the hop; a retry cut is a separate latency change with no measurement yet
- **cost of (a)**: none per hop. the client's own retries cost up to 2 × `retry-after` per throttled host, up to 60s each; the readme states this
- **cost of (b)**: every throttled host adds its full wait to an ask the next host could serve now
- **rework**: clean — a sleep before the recursive call, or a `{ maxRetries: 0 }` per send to cut the client's own waits
- **follow-up**: `.dream/v2026_10_21.measure.retry-cut-on-hop-sends.md`, owner tier-fallback-and-speed-waiver
- **confidence**: 70% (fork 2); 80% (fork 1)
- **where**: `getOneFloorCompletion`, `getOneAdmittedSetCompletion`, `getOneFloorExhaustedError`
- **raised by**: 5.1 peer `enroll-impl-behavior-intent`, i005 nitpick (points 2 and 6), i006 nitpick.1; `enroll-impl-arch-defects` i006 point 3
- **verdict**: fork 2 — keep, robot:director (best guess); fork 1 — —
