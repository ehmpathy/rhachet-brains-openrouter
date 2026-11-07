# F22 — the floor hop and the admitted-set call stay two leaf operations

- **fork:** one `getOneCompletionFromAdmitted({ admitted })` for both paths · two leaves, one per
  path
- **taken:** two leaves. they share one provider body (`asProviderPreference`) and one bounded
  call (`getOneCompletionWithinBound`), so the provider body cannot drift between them. what differs is the admitted set and its name in a fault: one host,
  or the whole qualified set. two usages is below the rule of three (`rule.prefer.wet-over-dry`)
- **rework:** clean — a merge touches two call sites
- **confidence 80%, why:** the shared parts are already one transformer each; a merge saves ~10
  lines and adds a param that names which path called
- **where:** `getOneCompletionFromEndpoint.ts`, `getOneAdmittedSetCompletion.ts`
- **verdict:** —
