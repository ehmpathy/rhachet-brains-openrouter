# F38 — the fetch call count is observed by a pass-through spy

- **fork**:
  - (a) drop `jest.spyOn(globalThis, 'fetch')`; inject a fetch wrapper into the sdk, or assert
    on latency alone
  - (b) keep the pass-through spy: no mock implementation, every read reaches openrouter, and
    only the call count is read
- **taken**: (b), at 5.3 i002 (peer r009 nitpick.1 asked for (a)).
  - the mechanic lesson for integration tests reads "never mock … can spy, but never mock". a
    `spyOn` with no `mockImplementation` calls the real `fetch`; the reply each assertion reads
    is openrouter's own
  - `rule.forbid.integration.mocks` forbids a mock because "mocks lie — they drift from real
    service behavior". a pass-through spy returns the real behavior, so that harm cannot arise
  - the facts under test are counts: a warm cache makes zero reads; twelve cold asks share one
    read (Q19). latency alone cannot prove "zero" or "one" — a fast read and a cached read look
    alike. an injected fetch would add a prod seam whose only caller is a test
  - each spy is restored in the same `useThen` that installs it
- **rework**: clean — a `context.fetch` seam on `sdkOpenRouterEndpoints`, if the council rules (a).
- **confidence**: 85%.
- **where**: `route/sdkOpenRouterEndpoints.integration.test.ts` [case2] and [case3].
- **raised by**: peer r009 (i002).
- **verdict**: —
