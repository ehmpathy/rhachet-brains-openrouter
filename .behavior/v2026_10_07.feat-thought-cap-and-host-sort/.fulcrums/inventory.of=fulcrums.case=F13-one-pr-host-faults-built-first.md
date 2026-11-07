# F13 — one PR for the whole vision; the host-fault half built and committed first

- **fork:** (a) one PR at the route's end, with the host-fault half built first · (b) a second
  branch cut from main for the host-fault half alone, its own PR now; the thought cap and sort
  follow here
- **taken:** (a). the director's ask: "ship that half first", and "the title is the final squash
  title". one branch holds one PR, and its title must cover what merges. neither path merges
  without a human (no `--apply`), so (b) gains the fleet no time to merge; it costs a second
  release cycle and a split of shared files (`getOneFloorCompletion.ts` holds both halves)
- **rework:** clean. a cherry-pick of the host-fault commit onto a fresh branch
- **confidence 70%, why low:** "ship" may mean a separate, earlier release of the live fix
- **where:** `5.1.execution.from_vision.yield.md`
- **verdict:** —
