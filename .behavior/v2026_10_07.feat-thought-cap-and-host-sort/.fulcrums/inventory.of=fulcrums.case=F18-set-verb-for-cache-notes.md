# F18 — `setFailureNoted` and the sdk `set*` methods keep the `set` verb

- **fork:** `set*` per `rule.require.get-set-gen-verbs` (set = idempotent upsert, the sanctioned
  mutation verb) · `upsert*` per `rule.forbid.nonidempotent-mutations`
- **taken:** `set`. the two rules disagree on `set`; this repo, and the ehmpathy convention it
  follows, takes get/set/gen/del as its operation vocabulary. `sdkOpenRouterEndpoints.setJsonIgnoredTag`
  and `setOneTierPick` predate this branch, and `setFailureNoted` matches them. each write is an
  idempotent upsert of a cache row (or a delete), so a re-run converges
- **rework:** clean. a rename via `sedreplace` across one sdk and its two callers
- **confidence 80%, why:** the rule conflict is real; the repo's extant vocabulary decides it
- **where:** `src/domain.operations/supply/getOneFloorCompletion.ts`, `sdkOpenRouterEndpoints.ts`
- **verdict:** —
