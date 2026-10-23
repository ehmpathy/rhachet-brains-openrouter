# F5 — an explicit hop, not `allow_fallbacks: true`

- **fork**: fix #21 by (a) an explicit hop: catch the host fault, drop that host from `only`, re-send · (b) flip `allow_fallbacks` to `true` on the admitted-set send and let openrouter fall back within `only`
- **taken**: (a). openrouter's provider-route docs (https://openrouter.ai/docs/features/provider-routing, fetched 2026-10-21) do not say a fallback stays inside `only`; `asProviderPreference.ts` pins `allow_fallbacks: false` so "openrouter can never leave the set we admitted" — the set that keeps privacy and price promises. (a) is provable with a stub client; (b) rests on undocumented behavior at a privacy boundary
- **rework**: clean — if openrouter documents that fallbacks respect `only`, (b) replaces the hop loop with one flag
- **confidence**: 85%
- **where**: `getOneAdmittedSetCompletion`, `asProviderPreference`
- **verdict**: —
