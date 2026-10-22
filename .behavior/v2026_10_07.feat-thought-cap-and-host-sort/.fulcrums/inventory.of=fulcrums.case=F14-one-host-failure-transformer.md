# F14 — one transformer decides which reply or error counts as a host failure: `asHostFailure`

- **fork:** (a) each supply path keeps its own checks (`asStepOutcome` + three `isReply*`
  calls inline in the floor walk) · (b) one named transformer that every supply path calls
- **taken:** (b), per the director (2026-10-21). a sibling tree,
  `beav/fix-429-hop-and-tier-fallback` (#21, #22, #23, plus a 400 that names a host), decides the
  same question. two trees that each grow a private copy diverge silently
- **the contract:**
  - file: `src/domain.operations/supply/asHostFailure.ts`
  - `asHostFailure(input: { error: unknown } | { response: ChatCompletion; expectsJson: boolean }): HostFailure | null`
  - `HostFailure = Exclude<FloorAttempt['outcome'], 'served'>`: throttled · refused · failed ·
    prose · empty · body-cut · stalled
  - `null` = not a host failure: the caller's error or a sound reply, passed on untouched
  - a new clause lands in this file, never at a call site. a new outcome joins `FloorAttempt`
- **clause ownership:**
  - this tree: transport (`body-cut`, `stalled`, via `HostFaultError`), reply (`prose`, `empty`,
    `failed`), and the gateway clause (issue #12: 502, 503, 504 only — narrowed at 5.3 i005 on a peer review, so a bare 500 rethrows as 0.1.3 did)
  - the sibling: status (`429`, `404`, a `400` that names a host)
  - whichever lands second rebases onto the other's clauses
- **call sites:**
  - the floor walk (`getOneFloorCompletion`) calls it on every hop, for the reply and for the
    thrown error. one verdict drives one step branch; `setFailureNoted` records what a failure
    proves (refused → drop the cached list; prose or empty → skip for json asks, 7 days)
  - the admitted-set path (`getOneAdmittedSetCompletion`) has no next hop of its own today. the
    transport faults already reach its caller named (`HostFaultError`), and its status errors stay
    raw so `getOneAskErrorNamed` can still read a 404 as a withdrawn model. the sibling's tier
    fallback (#22) is the first step it can take, so it wires the call there
- **rework:** clean. one file and two call sites
- **confidence 70%, why low:** the director asked for both paths to call it now. a call on the
  admitted-set path with no step to take would be dead code that reads as a decision, so it waits
  for #22
- **where:** `asHostFailure.ts`, `getOneFloorCompletion.ts`
- **verdict:** —
