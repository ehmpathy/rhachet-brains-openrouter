# F29 — the served endpoint is known by provider name; a set pin takes the cheapest match

- **fork**:
  - (a) match the reply's provider to the pinned set; take the first, which is the cheapest
    (the set is rank-ordered)
  - (b) add a `servedTagProven: boolean` to `RouteReport`, false when two pins share a provider
  - (c) refuse to pin two endpoints of one provider in one set
- **taken**: (a), with the limit named in code.
  - openrouter's reply names the PROVIDER, never the endpoint (probed: `provider` is a name
    such as `DeepInfra`). no field tells `deepinfra` from `deepinfra/fp8`
  - the floor walk — the preferred slug's path — pins ONE endpoint per hop, so its served tag is
    exact. only a non-floor filtered slug pins a set, and only a set with two endpoints of one
    provider is ambiguous
  - in that case both endpoints passed every filter, so every promise is kept either way. what
    can be wrong is the reported tag and estimate, never a kept promise
  - (b) changes the public `RouteReport` contract for a case the preferred slug never reaches
  - (c) narrows the route — a caller who asked for any qualified endpoint loses half the pool
  - `asRankedReport`'s `-1 → head` guard is unreachable today: the served pin comes from the
    qualified set, which the verdicts contain. it stays as a guard, now annotated
- **rework**: clean — (b) is one field and one comparison.
- **confidence**: 80%.
- **where**: `getOneServedEndpoint.ts`, `asRankedReport.ts`.
- **raised by**: arch-hazards-behavior, 5.1 i003 nitpick.7 and nitpick.12.
- **verdict**: —
