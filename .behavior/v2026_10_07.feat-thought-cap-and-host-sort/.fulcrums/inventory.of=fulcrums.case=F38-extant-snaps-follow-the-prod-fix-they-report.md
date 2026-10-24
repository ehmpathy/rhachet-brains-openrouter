# F38 — extant snaps and asserts follow the prod fix they report

- **fork:** where a prod fix on this branch changes text or shape an unset ask already showed (the
  `honors(json)` label, the floor-exhausted headline, the per-param funnel rows, the exhausted
  error's `untried` and `bound` keys), the extant tests move with it · each change waits on a
  wisher sign-off, one by one · the fix is held back so the old text stays
- **taken:** the tests move with the fix, and each change gets a row in the 5.3 yield's snapshot
  rationalization. no assertion is dropped; each asserts its behavior against the new text
- **why at the time:**
  - each text change reports a behavior fix the director put in this tree: issue #24 (0-char
    `stop` replies now count as a json miss, so the label must name them), issue #12 (the walk now
    steps past a gateway failure, a cut body, a stall, so the headline must name them), and the
    per-param split (a refusal names the one param that emptied the set, case=6)
  - to keep the old text would make the report lie: "not seen in prose" on a host skipped for a
    0-char reply, "failed mid-reply" on a host that stalled
  - "an ask that sets neither behaves exactly as 0.1.3" is held for the request an unset ask sends
    (the body snaps, field for field, and acc `[case2]` reads the wire). the text a caller reads
    when a host fails is the report of a host fault, which these fixes changed on purpose
- **rework:** clean. each string is one constant in prod; the old text is in `git show HEAD`
- **confidence 80%, why not higher:** "behaves exactly as 0.1.3" may be meant to cover every
  string an unset ask can print, not only the request. if so, the wisher wants these fixes in their
  own release, and this branch would carry the old text
- **where:** `getAllQualifiedEndpoints.ts` (the json-memory label, the per-param rows),
  `getOneFloorExhaustedError.ts` (the headline, `untried`, `bound`), and their tests and snaps
- **verdict:** — (for the wisher)
