# F17 — the live model id is masked in the zero-qualified refusal snapshot

## .the fork
1. **pin the exact id** in the snapshot (`deepseek/deepseek-v4.1-flash`)
2. **mask it, plus a `toMatch`** that the headline names a deepseek flash model
3. **mask it, plus an exact match** against the id the tier resolves to, read live

## .taken: 2, and why at the time
a tier resolves to openrouter's newest model of its family, so the id changes with each
openrouter release: `-1017` shipped and the extant snapshot broke with no change in this repo.
option 1 breaks the suite on every release. option 3 would re-derive the tier pick inside the
test, a second copy of prod logic that can drift from the first. the snapshot's job is the
render a human reads; the `toMatch` pins the model family. the id itself is proven where the
pick is made (`getOneTierPick`, its own tests).

raised by 5.3 peer lane r12 (blocker.5, i008 and i010).

## .rework: clean
option 3: read the tier pick in the test and `toContain` it.

## .confidence: 75%, and why it is not higher
the regex accepts any deepseek flash variant; a wrong pick within the family would pass here.

## .where
`src/contract/sdk/getBrainAtomsByOpenRouter.acceptance.test.ts` [case6]

## .verdict
open — for the council
