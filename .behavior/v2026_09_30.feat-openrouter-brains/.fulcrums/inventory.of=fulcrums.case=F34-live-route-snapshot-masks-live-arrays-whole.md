# F34 — the live route snapshot masks the hop trail and the ranked rows whole

- **fork**:
  - (a) keep each hop's outcome and each ranked row's verdict in the live snapshot
  - (b) mask both arrays whole in the live snapshot (the last hop's outcome and the row keys
    stay); pin each row's shape in the unit snapshots, on fixed inputs
- **taken**: (b), at 5.3 i001 (peer r004 nitpick.1/2 asked for (a)).
  - each hop's outcome is live: a throttle on the cheapest host adds a `throttled` hop before
    `served`. each ranked row's verdict is live too: it reads the host's tps and rate right now.
    so (a) is not a masked snapshot, and it goes red on a quiet day at openrouter
  - the row shape is pinned where its inputs are fixed: `route/__snapshots__/asRankedReport.test.ts.snap`
    (tag, estUsd, tps, verdict) and `route/__snapshots__/getOneFloorCompletion.test.ts.snap` (the
    hop trail, per outcome)
  - the live snapshot keeps all that is computed from the slug and the prompt: each funnel
    promise, the token estimate, the last outcome, and the row keys
- **rework**: clean — the masker is one test helper.
- **confidence**: 85%.
- **where**: `atom/genBrainAtom.route.integration.test.ts` `asStableRoute`; acceptance `asStableRoute`.
- **raised by**: the driver, at peer r004.
- **verdict**: —
