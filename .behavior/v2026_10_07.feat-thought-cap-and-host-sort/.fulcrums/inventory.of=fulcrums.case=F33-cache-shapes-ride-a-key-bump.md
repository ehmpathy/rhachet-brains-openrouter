# F33 — a changed cache shape rides a key bump, never a read-time check

- **fork:** a new field in a cached shape bumps the cache key (`endpoints.v2`) · each read
  validates the cached shape, and a stale entry reads as a miss
- **taken:** the key bump, as main's `catalog.v2` already does. a stale entry is never read,
  since its key is never asked for. the bump carries a note that names why
- **rework:** clean — a zod parse in `deserialize`, with a miss on failure
- **confidence 75%, why low:** the next shape change must remember to bump; a forgotten bump
  reads `maxCompletionTokens` as undefined, and the budget check then drops every host and blames
  the budget
- **where:** `sdkOpenRouterEndpoints.ts`
- **verdict:** —
