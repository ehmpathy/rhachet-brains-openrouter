# F33 — the acceptance suite covers the journeys a live call can force; provider-state journeys stay at the unit grain

- **fork**:
  - (a) an `.acceptance.test.ts` case for every journey
  - (b) an acceptance case for every journey a live call can force through the built package;
    the journeys that need openrouter or a host in a broken state are proven at the unit grain,
    on recorded response shapes
- **taken**: (b), at 5.3 i001 (peer r004 asked for (a)); widened at 5.3 i003 (peer r004 blocker.1).
  - forced live, via the built package: case=1, 2, 3, 4, 5, 6, 12, 13, 19, 20, 23, 28, 29 —
    acceptance cases 1–12 and `readme.acceptance`
  - cannot be forced on demand:
    - case=7, case=17 (402 — the test key would have to be drained)
    - case=11, case=16 (an endpoints-read outage, and the retry after it)
    - case=14, case=18, case=24 (429 on every qualified host, or on openrouter's own fallbacks)
    - case=21 (a throttle on the cheapest host)
    - case=22 (a mis-route by openrouter)
    - case=25 (a host that fails mid-reply); case=27 (a model that emits tool arguments that are
      not json)
    - case=26 (a withdrawn model): the refusal fires when an id the catalog lists past its
      `expiration_date` answers 404. probed 2026-10-02: 28 of 464 ids are dated, the earliest
      2026-10-05, so no listed id is past its date. openrouter drops a model from `/models` once
      withdrawn, so such an id exists only in the window between the date and the drop
  - to force any of those, a test would mock the boundary, and `rule.forbid.acceptance.mocks`
    forbids that. or it would drain a real key or wait on a real outage, which no suite can
    schedule. the unit tests clamp each one on response shapes captured from the live api
- **rework**: clean — a new acceptance case per journey, once a way to force that state exists
  (for example, a dedicated key with a spend cap for case=7).
- **confidence**: 80% — a council may want a scheduled drained-key suite for case=7.
- **where**: `5.3.verification.yield.md` journey table; `contract/sdk/getBrainAtomsByOpenRouter.acceptance.test.ts`.
- **raised by**: the driver, against `rule.require.acceptance-journey-coverage` (peer r004 blocker.3/4).
- **verdict**: —
