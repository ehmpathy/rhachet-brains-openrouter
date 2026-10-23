# F13 — the transformer unit suites stay data-driven caselists, not given/when/then

## .the fork
1. **caselist** — `TEST_CASES.map((thisCase) => test(thisCase.description, ...))`, one row per
   input, as `rule.prefer.data-driven` prescribes for unit tests of transformers
2. **given/when/then** — wrap each row in `given('[caseN] …')` / `when('[t0] …')` / `then(…)`,
   as `rule.require.given-when-then` expects of unit tests

## .taken: 1 (caselist), and why at the time
raised by 5.3 peer lane r7 (mech-given-when-then, nitpick.1) on `asRetryAfter.test.ts`,
`asEndpointsSplitByProvider.test.ts`, `asSupplyAttemptsOfFault.test.ts`, `asHostFault.test.ts`,
`asHostFaultReason.test.ts`. each subject is a pure `as*` transformer: one input, one output, no
scene, no act beyond the call. `rule.prefer.data-driven` names exactly this case ("especially
unit tests of transformers"). the two rules disagree here; the narrower one, written for this
grain, governs. a given/when/then wrapper per row would add three frames around one `expect` and
spread a ~30-row decision table (`asHostFault`) across ~120 lines, which makes the table harder to
scan as a table. the stateful suites in this PR (admitted, floor, supplied) use given/when/then.

## .rework: clean
a mechanical wrap of each row; no assertion changes.

## .confidence: 85%, and why it is not higher
`rule.require.given-when-then` says unit tests are "recommended" to use it, and a reviewer may
read the require rule as the stronger of the two.

## .where
the five `*.test.ts` files above, in `src/domain.operations/supply/`

## .verdict
open — for the council
