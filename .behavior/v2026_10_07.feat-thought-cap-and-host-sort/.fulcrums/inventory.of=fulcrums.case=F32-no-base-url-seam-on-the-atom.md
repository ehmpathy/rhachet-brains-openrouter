# F32 — the atom keeps no base-URL seam, so the socket faults are proven one layer down

- **fork:** `genBrainAtom` takes a base URL (or a client) a test can aim at a local server · the
  socket faults are proven on the supply leaves, with an injected client, and the atom's error
  path by unit
- **taken:** no seam. the socket test drives `getOneFloorCompletion`, `getOneSuppliedCompletion`
  and `getOneAdmittedSetCompletion` over real sockets. the one step above them, `genBrainAtom →
  getOneAskErrorNamed → rethrow`, is a pass-through with its own unit test. a seam widens the
  public contract for one test's sake
- **rework:** clean — an optional `baseURL` on the supplier context, unexported from the readme
- **confidence 70%, why low:** a regression in the atom's catch would pass every socket test.
  two reviewers (r010, r011, i007) named the gap
- **where:** `genBrainAtom.ts`, `getOneFloorCompletion.socket.integration.test.ts`
- **verdict:** —
