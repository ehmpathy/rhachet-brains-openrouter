# F20 — floor ranks by input rate

**fork:** sort the qualified set by (a) input rate · (b) input + output rate, blended · (c) this
ask's estimated cost, each rate weighed by the ask's token mix.

**taken:** (a), as the wisher ruled. `getOneEndpointCostEstimate` returns the ask's input tokens
(≈ `ceil(JSON.stringify(messages).length / 4)`) × the endpoint's input rate. the output rate never
moves the rank; ties go to the higher p50 (F3). the estimate is reported as `estUsd`, so the
caller sees the input cost each endpoint would charge.

**rework:** clean — one comparator, already reworked.

**confidence:** ruled.

**clamp:** `getAllQualifiedEndpoints.test.ts` — a 10-token ask and a 22k-token ask both head with
the cheapest-input endpoint (relace's shape: input $0.03/M, output $0.60/M), over a cheaper-output
peer.

**where:** `src/domain.operations/route/getAllQualifiedEndpoints.ts`

**verdict:** (a), wisher, 2026-10-01: "we only care about input costs really, dont worry about
output costs". (c) had been built first; its 1000-token output default undercounted a review's
output ~20× (21,928 and 30,911 tokens on the 1.vision peer reviews), and the verdict retires the
guess outright.
