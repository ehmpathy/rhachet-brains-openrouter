# F36 — live tests read the request body through a passthrough spy

- **fork:** the live tests read what went to openrouter through
  `jest.spyOn(Completions.prototype, 'create')`, which records each call and lets it run · they
  read it at a real local HTTP server that forwards to openrouter · they do not read the body live
  at all, and leave that to the unit body snaps
- **taken:** the passthrough spy. no `mockImplementation`, `mockResolvedValue` or
  `mockReturnValue` is set, so every call goes to openrouter and its real reply comes back.
  `mockClear` resets the record of calls only
- **why at the time:**
  - the mechanic lesson draws this exact line: "add .integration.test.ts file (collocated), never
    mock. can spy, but never mock" (`code.test/lessons.howto/howto.write.[lesson].md.pt2`)
  - `rule.forbid.integration.mocks` and `rule.forbid.acceptance.mocks` name what a mock does
    wrong: it "returns what you tell it", "drifts", and leaves you to "verify only your
    imagination". a passthrough spy returns what openrouter returns, so none of these applies
  - precedent on main: `sdkOpenRouterEndpoints.integration.test` (#7) already uses
    `jest.spyOn(globalThis, 'fetch')`, commented "spy, never mock: the reads are real; only the
    count is observed"
  - the acceptance "no call was sent" check needs a per-call record. the earlier proof read the
    key's shared `/key` usage total, which raced other sessions' spend on the same key
- **why not a local proxy server:** the atom builds its own openai client against openrouter's
  url and keeps no base-url seam (F32). a proxy would need that seam in prod code, used only by
  tests
- **rework:** clean. swap the spy for a recording proxy once a base-url seam exists; each test
  reads `body` and `callsSent` through one helper
- **confidence 80%, why not higher:** a reviewer reads `jest.spyOn` as a mock by its api name
  (`mock.calls`, `mockRestore`). the rules forbid a mock by its effect, not its api, but that
  reading is mine. the wisher may draw the line at the api
- **where:** `genBrainAtom.effort-and-sort.integration.test.ts` (`spyCreate`, the body read);
  `getBrainAtomsByOpenRouter.acceptance.test.ts` (`spyCreate`, the no-spend check)
- **verdict:** — (for the wisher)
