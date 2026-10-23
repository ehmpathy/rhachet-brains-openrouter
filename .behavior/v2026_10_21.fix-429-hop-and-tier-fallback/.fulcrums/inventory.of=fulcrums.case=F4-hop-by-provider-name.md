# F4 — admitted-set hop drops by provider name; no name → walk the set

- **fork**: on a host fault in the admitted set, which endpoints leave `only`?
  - (a) every endpoint whose `providerName` equals `error.metadata.provider_name`
  - (b) on no name, drop the cheapest admitted endpoint as a guess
  - (c) on no name, re-send the same set (retry)
  - (d) on no name, walk the set one endpoint per send, as the floor walk does
- **taken**: (a) for a fault that names an admitted host, (d) for a host-marked fault (a name, or the `Provider returned error` marker) that names none. (a) is sure to drop the host that faulted, and it strictly shrinks `only`. (d) admits one host per send, so each fault there names its host by `only`, and the walk ends in at most one send per endpoint. (b) may drop a healthy host and keep the bad one; (c) can loop on a host that throttles every time
- **no host mark**: rethrows untouched in one send, per vision c9. an unmarked 429 is openrouter's own account limit and an unmarked 404 a withdrawn model; no other host can fix either, and a walk would spend up to 3(N+1) sends and prolong the limit
- **rework**: clean — the fallback is one branch in `getOneAdmittedSetCompletion`
- **confidence**: 85% — (d) costs one extra send per unnamed fault, and a host that throttles may be tried twice (once in the set, once alone)
- **where**: `getOneAdmittedSetCompletion`
- **clamps**: walk — admitted [case9], [case12] t0/t1, real-client [case4]; rethrow — admitted [case7] t0/t1, real-client [case2]
- **verdict**: —
