# research — how openrouter exposes many suppliers of one model, and what we can prove

measured 2026-10-01, live, `deepseek/deepseek-v4.1-flash`, key `ehmpath/test`. raw evidence:
`research.route-probe{,-2,-3,-4}.v2026_10_01.json` beside this file.

## the supply side — one model, 33 endpoints

openrouter exposes each model as a set of **endpoints**. each endpoint = one supplier (`provider_name`)
× one deployment variant (`tag`: `deepinfra/fp8`, `fireworks/us`, `baseten/fast`). per endpoint:
price (prompt, completion), quantization, supported parameters, uptime, and — **on an authenticated
read only** — `throughput_last_30m` and `latency_last_30m` as p50/p75/p90/p99.

| fact | value |
|---|---|
| endpoints | 33 |
| prompt price range | $0.026/M (`relace`) → $0.60/M (`baseten/fast`) — **23×** |
| completion price range | $0.40/M → $2.40/M — 6× |
| throughput p50 range | 7 tok/s (`open-inference/fp4`, the 2nd cheapest) → 238 tok/s (`together`) |
| unauthenticated throughput | `null` on every endpoint — the Q3 cause |
| endpoints on openrouter's zero-data-retention list (`GET /endpoints/zdr`) | 27 of 33. absent: `atlas-cloud/fp8`, `streamlake/fp8`, `alibaba`, `deepseek`, `gmicloud/fp8`, `baidu/fp8` |
| endpoints with a region in the tag | 1 — `fireworks/us` |
| endpoint lacks `response_format` | `relace` (cheapest), one `baseten/fp8` |
| endpoint id in the endpoints api | **absent**. the generation record names attempts only by `endpoint_id` |

## the demand side — what each request control does, observed

| request | n | served | verdict |
|---|---|---|---|
| no `provider` (what the package sends today) | 12 | AtlasCloud ×8, Together ×4 | openrouter's balancer. **1.4–4.9× the floor cost**, and AtlasCloud is **not** zero-retention |
| `provider.sort = 'price'` | 12 | AtlasCloud ×7, Together ×5 | **not the cheapest** — see the trail below |
| `sort = 'price'`, `allow_fallbacks: false` | 4 | Relace ×4 | the cheapest. so sort only orders the **first** attempt |
| `sort = 'price'` + generation trail | 3 | OpenInference, OpenInference, **OpenInference 429 → AtlasCloud** | 🔴 on a 429 the fallback skips 8 cheaper healthy endpoints |
| model suffix `:floor` | 10 | Relace ×10 | first pick is the cheapest. fallback order on a 429: unobserved |
| `order` = our cheapest-first list, `only` = same | 8, burst | OpenInference ×8 | our order held; no throttle occurred, so fallback order still unobserved |
| each cheap endpoint pinned via `only`, no fallback | 11 | each served | the cheap endpoints are healthy; they were skipped, not down |
| `max_price` below every endpoint | 1 | **404** `No endpoints found that satisfy the max price` | a hard price bound, refused before any spend |
| `max_price` that admits one endpoint | 2 | 429 ×2 | the one admitted endpoint throttled; no silent route elsewhere |
| `zdr: true` | 2 | Together, DeepInfra | both on the zdr list |
| `data_collection: 'deny'` | 2 | AtlasCloud ×2 | ⚠️ **not** a retention guard — AtlasCloud is off the zdr list |
| `only: ['fireworks/us']`, no fallback | 2 | Fireworks, then 429 | the one usa-tagged endpoint serves, and throttles |
| sort price + `only: [fireworks/us]` + zdr + deny, no fallback | 2 | 429 ×2 | the wish composite today has **one** qualified endpoint, and it throttled |
| `only: [relace]` + schema + `require_parameters` | 1 | **404** `No endpoints found that can handle the requested parameters` | parameter guard holds |

the key record (`GET /key`) carries `allowed_data_regions: ["global"]` — a key-level region control
openrouter exposes. its other values and plan gate are unknown (Q16).

## what this means

1. **the expensive call was ours.** no `provider` field ⇒ openrouter's balancer, which weighs speed
   and uptime beside price.
2. **`sort: price` is a first-pick rule, not a floor.** cheap endpoints throttle most, so a price sort
   regularly lands mid-table. a provable floor owns its own fallback walk.
3. **`data_collection: deny` ≠ no retention.** only `zdr: true` held the zdr list. `privacy=full`
   needs both, and a post-call check against the zdr list.
4. **every served call is auditable.** `GET /generation?id=` lists each attempt: provider,
   `endpoint_id`, status. that is the post-call proof channel.
5. **endpoint identity needs calibration.** `fireworks` and `fireworks/us` are both "Fireworks". to
   prove `fireworks/us` served, map `endpoint_id → tag` via one pinned call per endpoint, recorded.
   probe 5 ([json](./research.route-probe-5.v2026_10_01.json)) pinned each and polled the record:
   `fireworks` → `834bf093-…`, `fireworks/us` → `b69086f3-…` — distinct ids, so the map can exist.
   4 of 6 pinned asks hit 429 (`limit_source: upstream_provider_shared_pool`, `retry_after_seconds`
   in the body).
6. **strict `region=usa` today = one endpoint** for this model. company domicile is not datacenter
   location, so a base tag cannot prove usa. the composite is honest and narrow, and throttles.
