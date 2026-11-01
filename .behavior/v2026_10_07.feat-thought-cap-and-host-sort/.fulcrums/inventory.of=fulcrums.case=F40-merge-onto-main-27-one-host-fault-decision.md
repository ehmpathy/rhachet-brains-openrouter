# F40 — the merge onto main's #27 keeps one host-fault decision, named "host fault"

- **fork:** main's #27 (a host fault walks to the next host) and this branch each grew a host-fault
  transformer (F14). the rebase could keep both side by side · keep main's and port this branch's
  transport faults into it · keep this branch's and port main's gateway and marker logic into it
- **taken:** one decision, `asHostFault`, with main's name. it reads a thrown error or a reply:
  - a reply fault (prose, empty) is marked to its host
  - a transport fault (`HostFaultError`: body-cut, stalled) marks no host, so the admitted set
    rethrows it untouched. the floor walk steps past it
  - 429 → throttled, 404 → refused, a marked 400 → failed, 502/503/504 → failed, with the host's
    name and marker read from the body. a bare 500 or an unmarked 400 → null, rethrown
- **the terms:** "host fault" is canonical, as main named it. `HostFault` names every outcome
  that is not served. the transport subset is `HostFaultTransport`. `setFailureNoted` became
  `setHostFaultNoted`. `asHostFailure` and `HostFailure` are deleted, so no synonym remains
- **behavior the merge adds on main's paths:**
  - the admitted set steps past a marked or named 502/503/504: the host is dropped and the set
    re-sent. a bare 500 still rethrows
  - the served row is appended once, by the caller, in both modes (main's shape). the floor walk
    reports only faults, so the socket and unit trails expect no served row
  - the exhausted error keeps main's `faultLast` → `cause` and the request-named fix, plus this
    branch's `untried`, `bound`, and stall lines
- **why at the time:** two transformers for one decision is the drift F14 was raised to prevent.
  main's name came first and is already released (v0.1.4)
- **rework:** clean. each fault kind is one row of `asStatusFault` or `PHRASE_BY_FAULT`. a
  reviewer who wants a gateway 5xx rethrown in the admitted set deletes one array entry
- **confidence 80%, why not higher:** a named 502 in the admitted set now hops, where main
  rethrew it. it is pinned at unit grain (`getOneAdmittedSetCompletion` case16), not live
- **where:** `asHostFault.ts`, `getOneAdmittedSetCompletion.ts`, `getOneFloorCompletion.ts`,
  `getOneFloorExhaustedError.ts`, `setHostFaultNoted.ts`, `domain.objects/HostFault.ts`
- **verdict:** open — for the commander, with #25
