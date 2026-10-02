# F25 — a background zdr refresh never throws behind; a read failure warns, a defect is held and thrown by the next ask

- **fork**:
  - (a) warn on every fault, keep the stale index
  - (b) allowlist the read failure (`MalfunctionError`) as a warn, rethrow the rest from the refresh
  - (c) drop the background refresh; every stale read waits on a live one
  - (d) allowlist the read failure as a warn; print any other fault as a `💥 MalfunctionError:`
    line on stderr, never throw
  - (e) allowlist the read failure as a warn; HOLD any other fault, and throw it from the next
    `getAllZdrTagsByModel` call — the next ask a caller awaits
- **taken**: (e).
  - no caller awaits the refresh: the ask it rode beside was already served from the stale index
  - so a throw there is an unhandled rejection, which halts a host on default node settings — a
    crash charged to an ask that succeeded (i003 arch-hazards-behavior blocker.2). that rules out (b)
  - a stderr line alone hides the defect from every caller (i005 mech-failhides blocker.1). that
    rules out (a) and (d)
  - (e) meets both: the defect is thrown, as a `MalfunctionError` with the fault as its `cause`,
    at the one seam a caller awaits; the host never sees an unhandled rejection
  - the read failure stays a warn: network, refused status, unparseable or drifted body — each
    wrapped as `MalfunctionError` by `getOneOpenRouterJson`. the stale index still serves, and the
    next stale ask retries
  - harm of a stale index is bounded: ≤ 24h, and every privacy=full call also sends `zdr: true`,
    so openrouter refuses an endpoint that left the list
  - (c) undoes the wisher's verdict (F19, "memoize it", with stale-while-revalidate)
- **rework**: clean — `asZdrRefreshFault` plus three lines in `getAllZdrTagsByModel.ts`.
- **confidence**: 88%. the defect throws on an ask that did not cause it; that ask is the first
  awaited seam, and a defect here is this package's own, so a loud fail there is the honest place.
- **where**: `src/domain.operations/route/getAllZdrTagsByModel.ts` (`setZdrIndexBehind`,
  `getAllZdrTagsByModel`) · `src/domain.operations/route/asZdrRefreshFault.ts` (unit-tested).
- **raised by**: arch-hazards-maintenance (i001 blocker.4, i002 nitpick.1),
  arch-hazards-behavior (i003 blocker.2), mech-failhides (i005 blocker.1).
- **verdict**: —
