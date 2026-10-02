# F19 — in-memory cache before disk cache

**fork:** add `simple-on-disk-cache` now (F16), or ship the dogfood with a per-process memory cache.

**taken:** memory cache, 30-min ttl, failed reads evicted (`sdkOpenRouterEndpoints.ts`). the wisher asked for a quick dogfood; a new dep is a package install with an audit.

**rework:** clean — swap `withCache` for `withSimpleCacheAsync` over the disk cache; one file.

**confidence:** 90% — cost: each reviewer process re-reads endpoints once (two GETs) per 30 min.

**where:** `src/domain.operations/route/sdkOpenRouterEndpoints.ts`

**verdict:** —
