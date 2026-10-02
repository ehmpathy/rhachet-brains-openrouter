# F16 — endpoints and zdr reads cached on disk

- **fork**: (a) read live per ask · (b) per-process memo · (c) `withSimpleCache` over
  `simple-on-disk-cache`, under `$HOME/.rhachet/storage/repo=openrouter/role=any/`, ttl 30 min.
- **taken**: (c) — the wisher's proposal.
- **why**: the spike measured the endpoints read at 46ms (290ms cold, 46KB) and the zdr read at
  143ms (1.17MB). per ask that is ~190ms for data that moves on a 30-min window. on disk, a fleet
  of processes on one machine pays once per half hour.
- **caveats**:
  - throughput is a 30-min window; cached 30 min, a value can be up to 60 min old. the readme says so.
  - cache the zdr list filtered to the model, not the 1.17MB whole.
  - an endpoint the cache lists but openrouter refuses as absent invalidates that model's entry
    and re-reads once, so a stale cache cannot strand a caller.
- **rework**: clean — the cache wraps two reads.
- **confidence**: 80%.
- **where**: yield §latency.
