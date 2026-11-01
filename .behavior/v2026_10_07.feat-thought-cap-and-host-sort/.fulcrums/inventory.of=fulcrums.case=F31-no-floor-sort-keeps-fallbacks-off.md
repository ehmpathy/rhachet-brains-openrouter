# F31 — a no-floor sort keeps fallbacks off, so a throttled top host ends the ask

- **fork:** a no-floor ask with `sort` keeps `allow_fallbacks: false`, as every call does in
  0.1.3 · it sends `allow_fallbacks: true`, so openrouter may fall to the next host in `only`
- **taken (5.1):** fallbacks stay off. whether openrouter keeps a fallback inside `only` was
  unverified. the readme named the hazard, and `floor` was the lever that steps past a failed host
- **measured 2026-10-21:** acceptance [case2e] (`…/flash/privacy=full&sort=throughput`) drew
  `429 Provider returned error` three runs in a row at 5.1. at 5.3, integration [case7] (same slug)
  drew it twice more, and once held it across three asks over 35s. the probe that followed saw 28
  hosts in `only`, so a 429 meant openrouter tried the top host alone
- **re-taken (5.3):** a sorted admitted set sends `allow_fallbacks: true`. floor hops (one tag per
  call) and an ask with no sort keep `false`, so an unset ask is still 0.1.3. the evidence:
  - openrouter's provider-routing docs: `only` "functions as a hard allowlist constraining
    fallbacks … the request's `only` list narrows within it"; with `sort` set, the router "will try
    providers in order … fallbacks remain available unless `allow_fallbacks` is also set to `false`"
  - a second guard holds regardless: the response must name a host in `only`, or no answer is
    returned (the enforced half of every call)
  - `zdr`, `data_collection`, `quantizations` and `max_price` ride the same `provider` object, so
    each promise binds every hop a fallback may take
- **rework:** clean — one argument, `fallbackWithinOnly`, set by each caller of
  `asProviderPreference`. reverse it with `false` in `getOneAdmittedSetCompletion`
- **confidence 80%, why not higher:** the docs are evidence, not a live proof. a live proof needs a
  host held down on demand, so the dream stays open to close the last 20%
- **where:** `asProviderPreference.ts`, `getOneAdmittedSetCompletion.ts`,
  `getOneCompletionFromEndpoint.ts`, `readme.md`, acc [case2e], integ [case7]
- **dream:** `.dream/v2026_10_21.probe.no-floor-sort-fallback-inside-only.md`
- **verdict:** — (for the wisher: this reverses the 5.1 best guess; `false` is a one-line revert)
