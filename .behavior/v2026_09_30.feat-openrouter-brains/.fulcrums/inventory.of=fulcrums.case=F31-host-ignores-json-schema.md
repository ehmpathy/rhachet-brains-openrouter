# F31 — a host that lists json support and replies in prose

- **the evidence** (2026-10-02, live):
  - `genBrainAtom.integration` case4, slug `openrouter/z-ai/glm-5.3-flash`, object schema: 5 of 5
    attempts answered plain text, twice in a row. the four other models passed
  - a probe sent six bare `json_schema` asks with `require_parameters: true`: Phala served 4 and
    replied in prose each time; DigitalOcean and InferenceNet served 2 and replied in json
  - Phala lists both `response_format` and `structured_outputs` for this model, so no param a
    caller can require excludes it
  - re-probed 2026-10-02 08:00: the same case, 5 of 5 attempts to Phala, each in prose. the other
    46 cases of the suite pass
  - this diff did not cause it: an object schema is classified the same before and after
- **fork**:
  - (a) name the defect and stop: the reply-defect check refuses prose where json is owed, and
    names the host and generation id. the caller retries, or asks for `z.string()`
  - (b) (a), plus the floor walk steps past a prose reply as it does a failed one (F26), so a
    filtered slug self-heals onto the next qualified host
  - (c) (a), plus a bare json ask routes through the qualified set too, and steps the same way —
    a bare slug would no longer mean "openrouter's balancer"
  - (d) re-aim `z-ai/flash/latest` and the pin off glm-5.3-flash, until the host is fixed
- **taken**: (a), now. (b) and (c) change what a bare slug means or what a hop may bill, which
  is a wisher call.
- **rework**: (b) clean — one more outcome in the walk. (c) **dirty** — the bare path's contract
  is cited by the readme and vision. (d) clean — one line in the tier map.
- **the cost of (a) alone**: `genBrainAtom.integration` case4 stays red for glm-5.3-flash while
  Phala misbehaves. it is left red on purpose — a skip would hide a real break a consumer of the
  static slug feels today.
- **confidence**: 60% — the right answer depends on how long Phala stays broken, which no read
  can tell.
- **where**: `getOneReplyDefectError.ts`; `getOneFloorCompletion.ts` for (b); `getOneRoutedCompletion.ts` for (c).
- **raised by**: the driver, from a red integration run at 5.1 i004; re-raised by
  behavior-intent-coverage at i005 (blocker.1: the vision's "schema honored" promise is unmet for a
  static slug). no change the driver may make alone closes it — each closes by a call this row
  reserves for the wisher.
- **verdict**: —
