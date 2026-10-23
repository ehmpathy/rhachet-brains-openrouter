# F15 — `supply.attempts` ends on a served row in both modes (vision c14)

## .the fork
1. **every send, last row is the serve** — first-try serve `[{ tag, served }]`
2. **faults only** — first-try serve `[]`; the served host read from `supply.provider`
3. **1, plus a `hops` count** — a new `SupplyReport` field

## .taken: 1, and why at the time
#21 adds hops to the admitted set, and vision cell c14 must pick one shape for both modes. one
rule (the trail tells the whole story of an ask, the serve as its last row) beats two. the extant
tests that asserted `[]` on a first-try admitted serve, and the floor trail that ended
`{ tag, served }` inside the walk, follow from this choice.

raised by 5.3 peer lane r12 (enroll-verif-test-intent, blocker.1, i008 and i010). its exact-trail
point is a verification gap, repaired in the route: `genBrainAtom.supply` [case6] [t1] ties the
live trail to the completion fetches (a recorded hop needs more than one fetch), and the unit
grain asserts each exact trail. the shape itself is a vision decision, so it goes up as a
question: `pr.body.draft.md` § needs your approval, Q1.

the live timeout (90s → 180s) follows F9, not this fork.

## .rework: clean
option 2: the composer's one append line, and the tests revert.

## .confidence: 75%, and why it is not higher
a consumer that tests `attempts.length === 0` for "no hop" breaks under option 1.

## .where
`src/domain.operations/supply/getOneSuppliedCompletion.ts` (the append), `SupplyReport`

## .verdict
open — for the commander (Q1)
