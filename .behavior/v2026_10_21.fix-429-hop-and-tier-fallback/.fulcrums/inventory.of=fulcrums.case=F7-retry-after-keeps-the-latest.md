# F7 — across hops, `retry-after` keeps the latest, not the longest

- **fork**: when several hops each carry a `retry-after`, which one does the exhausted error report? (a) the latest one seen, as the floor walk does · (b) the longest one seen
- **taken**: (a). the header is openrouter's own (the gateway's), not a host's, so hops of one ask carry one clock in practice; and (a) keeps one rule across both paths. (b) is the safer read if hosts ever diverge, and it would change both paths together
- **rework**: clean — one transformer (`asRetryAfterLongest`) at the two call sites, plus a clamp
- **confidence**: 75% — no capture yet shows two hops of one ask with different waits
- **where**: `getOneAdmittedSetCompletion`, `getOneFloorCompletion`
- **raised by**: 5.1 peer `arch-hazards-behavior`, i001 nitpick.1
- **verdict**: —
