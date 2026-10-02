# F37 — transformer unit tests stay data-driven caselists

- **fork**:
  - (a) wrap each of the 32 caselist unit suites in `given('[caseN]')` / `when('[tN]')` / `then()`
  - (b) keep the `TEST_CASES` caselist shape for pure transformer unit suites; given/when/then
    binds every integration and acceptance suite, and each unit suite with setup or a sequence
- **taken**: (b), at 5.3 i002 (peer r004 nitpick.1 and r007 nitpick.1 asked for (a)).
  - `rule.require.given-when-then` grades the shape `required: integration tests` and
    `recommended: unit tests` — a nitpick by its own word, never a must
  - `rule.prefer.data-driven` names this exact shape for "unit tests of transformers", with a
    `TEST_CASES` array mapped to `test(thisCase.description, …)`. each of the 32 files is a pure
    `as*` / `is*` / `get*` transformer with no setup and no sequence of actions
  - a caselist row IS a given and its expect: one row, one input, one output. a `given` / `when`
    wrap per row adds two labels that restate the row's `description`, and three nest levels
  - the suites that do carry setup or a sequence (`asAtomTarget`, `getOneCatalogModel`,
    `asPinnedAtomSlug`, and every integration and acceptance suite) already use given/when/then
  - peer r007 at i003 holds the opposite, fairly: the rule's `.where` says "all test suites", and
    five files (`getOneRoutedCompletion`, `getOneServedEndpoint`, `getAllQualifiedEndpoints`,
    `getOneReplyDefectError`, `isReplyFailed`) build fixtures before they act. those five are
    still one call per row with no sequence of acts, so the caselist holds; a council that reads
    fixture setup as "setup" would wrap those five first
- **rework**: clean — a per-file wrap; no prod file moves, no assertion changes.
- **confidence**: 70% — two rules apply at the unit grain; a council may prefer one shape repo-wide.
- **where**: the 32 `*.test.ts` files that r004 and r007 list, under `atom/`, `route/`, `infra/cast/`.
- **raised by**: peer r007 (i001, i002) and r004 (i002).
- **verdict**: —
