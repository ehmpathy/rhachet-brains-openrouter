# F16 — a refused ask's "no spend" is proved by a count of completion sends

## .the fork
1. **the key's `/key` usage, before vs after** — the extant instrument
2. **the completion sends of the ask, via a `fetch` spy** — observe only, `toEqual(0)`, with a
   served-ask control that must count `≥ 1`
3. **both** — keep the usage diff beside the send count

## .taken: 2, and why at the time
the claim is "a refused ask spends no credit". credit is charged only by a completion send, so a
count of zero sends proves it exactly. `/key` usage is one meter for the whole key, and it moved
with no send from the refused ask, even after a settled read (two reads 3s apart agree):

- 198.067 → 198.042 (down)
- 207.853540386 → 207.853557046 (up)
- 207.895409165 → 207.886538656 (down)

option 3 keeps that flake, so it was rejected. the reviewer's bound — the spy sees only sends
through the global `fetch` — is the bound the control closes: acceptance [case3b] sends a served
ask through the same counter and must count `≥ 1`, so a client that sends by another path goes
red there.

raised by 5.3 peer lane r12 (blocker.4, i008 and i010).

## .rework: clean
restore the usage read beside the count.

## .confidence: 85%, and why it is not higher
a future client could send by a path other than the global `fetch`; the control catches it, but
only on the next live run.

## .where
`src/contract/sdk/getBrainAtomsByOpenRouter.acceptance.test.ts` (`getOneSendsOfRefusedAsk`, [case3b])

## .verdict
open — for the council
