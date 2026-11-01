# F25 — the sdk's default retries stay on every hop, the floor hop included

- **fork:** keep the sdk's default `maxRetries: 2` · set `maxRetries: 0` on the floor hop, so the
  walk is the one retry policy · set it to 0 everywhere
- **taken:** keep the default, as 0.1.3 sends it. a transient 5xx or 429 on the cheapest host is
  retried there before the walk steps to a dearer one
- **rework:** clean — one per-request option in `getOneCompletionWithinBound`
- **confidence 60%, why low:** a retried hop can send up to three requests inside one bound, and
  the sdk sleeps a 429's `retry-after` in place rather than step. measured on a real socket
  (`getOneFloorCompletion.socket.integration`): a 502 host under a 500ms bound reads as `stalled`,
  since its retries outlast the bound. under the 10-minute bound it reads as `failed`
- **where:** `getOneCompletionWithinBound.ts`
- **verdict:** —
