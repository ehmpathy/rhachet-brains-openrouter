# F26 — the floor walk steps past a host that failed mid-reply

- **fork**: (a) a reply with `finish_reason=error`, no choice, or no `choices` array at all (an
  `error` object in its place) counts as a host failure, and
  the floor walk steps to the next cheapest endpoint · (b) the failed reply is named to the caller
  as a reply defect, and no other endpoint is tried · (c) step, and also drop the model's cached
  endpoint list, as a refusal does
- **taken**: (a).
  - `floor` promises the cheapest endpoint that SERVES. a host that answers 200 and ends its reply
    in error did not serve; to stop there hands the caller a failure a pricier, healthy host would
    have answered
  - the walk already steps past a throttle (429) and a refusal (404) for the same reason
  - (c) rejected: openrouter still lists the host, and its endpoint read is still true. the host
    failed this ask, not the list. a drop would force a live read for no gain
  - the pinned-set path (no `floor`) keeps (b): openrouter balances that set itself, so a failed
    reply there is named as a reply defect (`getOneReplyDefectError`)
- **cost**: a failed hop may still bill its input tokens. the walk trades that spend for an answer
- **rework**: clean — one branch in `getOneFloorCompletion`, plus the `'failed'` outcome on
  `FloorAttempt`. a revert to (b) deletes the branch.
- **confidence**: 85% — measured, not inferred. on 2026-10-02, 6 of 9 review lanes on
  `deepseek/flash/floor&privacy=full` failed this way. four hit InferenceNet (the cheapest zdr
  host, $0.04/M input, declared context 1.04M): each answered 200 with 1 output token and
  `finish_reason=error` on a large prompt. two got a 200 body with no `choices` array, and
  crashed on a bare TypeError. what is unknown is whether that host fails every large prompt or
  only some.
- **clamp**: `getOneFloorCompletion.test.ts` case6 (finish_reason=error) and case7 (error body),
  each proven red; case4 extended to a `failed` hop; `asReplyChoice.test.ts`.
- **where**: `src/domain.operations/route/getOneFloorCompletion.ts`, `route/isReplyFailed.ts`,
  `route/asReplyChoice.ts`.
- **raised by**: i002 malfunctions on mech-failhides, mech-decode-friction,
  arch-opport-decomposition, arch-smell-scopeleaks, arch-hazards-behavior, behavior-intent-coverage.
- **verdict**: —
