# F13 — the static set we promise long-term support for

- **fork**: (a) no static slugs; wildcard only · (b) today's five per-tier versionless aliases
  in `AtomSlug.latest.ts` (`openrouter/deepseek/{flash,pro}`, `openrouter/moonshotai/pro`,
  `openrouter/z-ai/{pro,flash}`) · (c) a wider menu.
- **taken**: (b).
- **why**: the wisher: "publish some of the common static ones like deepseek/flash … that we know
  we'll be able to provide longterm support for." a versionless per-tier slug is the shape that
  survives a model bump (`rule.require.versionless-slug-per-tier`); each re-aim costs one live probe.
- **open**: which tiers earn a forever promise. deepseek flash is the reviewer default; the rest
  is a judgment the wisher may tighten.
- **rework**: clean — a new slug is free; a dropped slug breaks callers, so start small.
- **confidence**: 65%.
- **where**: yield §what we publish.
- **verdict** (wisher, 2026-10-01): (b), all five — "the main ones max used today".
