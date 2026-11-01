# F16 — the floor walk stops after two stalled hosts

- **fork:** (a) no aggregate bound: each hop owns its 10-minute bound (F11), so a walk over N
  stalled hosts can hold the caller for N × 10 minutes · (b) an aggregate deadline in wall-clock ·
  (c) a count cap: stop after `STALLS_PER_WALK_MAX` stalled hosts, and name the hosts left untried
- **taken:** (c), at 2. a stall is the costliest outcome a hop has; two in one walk says the
  fault is upstream of any one host (openrouter, the route, the network), so a third hop mostly
  spends ten more minutes to learn the same. a count needs no clock in the walk, and the error
  names how many hosts stayed untried, so the caller knows a retry has room
- **rework:** clean. one constant in `getOneFloorCompletion.ts`; a later tree may derive it or
  swap it for a deadline with no caller change
- **confidence 65%, why low:** 2 is a judgment, not a measurement. no run has yet shown how often
  a second stall precedes a third host that serves
- **where:** `src/domain.operations/supply/getOneFloorCompletion.ts` (`STALLS_PER_WALK_MAX`),
  `getOneFloorExhaustedError.ts` (`untried`)
- **verdict:** —
