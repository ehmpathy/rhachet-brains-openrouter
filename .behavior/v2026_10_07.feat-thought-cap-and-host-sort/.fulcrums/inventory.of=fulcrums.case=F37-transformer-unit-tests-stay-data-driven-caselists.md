# F37 — transformer unit tests stay data-driven caselists, as the repo writes them

- **fork:** the new and extended transformer unit tests keep the repo's `describe` +
  `TEST_CASES.map((c) => test(c.description, …))` form · each is rewritten into
  `given('[caseN]') / when('[tN]') / then(…)` blocks
- **taken:** keep the caselist form in files that already use it. a new file may wrap its rows
  in given/when/then (`asRetryAfter.test.ts` does)
- **why at the time:**
  - `rule.prefer.data-driven` (mechanic) prescribes exactly this form, "especially unit tests of
    transformers", and its example is `describe` + `TEST_CASES.map(test(...))`
  - `rule.require.given-when-then` marks given/when/then as *required* for integration tests and
    *recommended* for unit tests. every integration and acceptance suite on this branch uses it
  - the extended files (`asProviderPreference.test`, `asSupplyFilters.test`,
    `getAllQualifiedEndpoints.test`, `getOneReplyDefectError.test`, …) use the caselist form on
    main. a new row in another form would split one file across two styles
- **rework:** dirty. a rewrite touches 22 files, and since jest keys each snapshot by its test
  path, it renames every snapshot key in those files. the diff would be mostly churn, which would
  hide the real changes from review
- **confidence 75%, why not higher:** four review lanes raised it. the two rules pull opposite
  ways for a unit test, and which wins is a house call, not mine
- **where:** the 22 unit test files the reviewers list
- **verdict:** — (for the wisher)
