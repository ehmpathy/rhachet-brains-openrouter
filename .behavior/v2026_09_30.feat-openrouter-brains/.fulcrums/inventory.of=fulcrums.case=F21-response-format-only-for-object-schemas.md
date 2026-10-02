# F21 — `response_format` sent and required only when the schema is not a plain string

**fork:** (a) send `response_format` and require it on every ask · (b) only when the output schema
is not `z.string()`, and never with tools.

**taken:** (b). a text ask needs no constraint, so to require one drops endpoints for no gain —
measured 2026-10-01: relace lacks `response_format` in `supported_parameters` and was the floor for
a 22k-token text ask once (b) let it in. a review asks for an object (`stepReview.js:76`), so
`response_format` stays required there and relace stays out of reviews.

**rework:** clean — one boolean in `genBrainAtom.ts` (`wantStructuredOutput`).

**confidence:** 90% — the open edge is a model that answers prose where a `z.string()` caller
expected json-in-a-string; that caller asked for a string, and gets one.

**clamp:** `genBrainAtom.route.integration.test.ts` case4 — a `z.string()` ask's funnel holds no
`supports(response_format)` step.

**where:** `src/domain.operations/atom/genBrainAtom.ts`; case=13 `[t3]`

**verdict:** —
