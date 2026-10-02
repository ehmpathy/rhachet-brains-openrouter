# F23 — retirement is read from openrouter's `expiration_date`, never hand-kept

- **fork**: (a) drop the inherited hand-kept maps (`PINNED_BY_LEGACY_SLUG`, `RETIREMENT_BY_ATOM_SLUG`)
  and read `expiration_date` off the cached `/models` list · (b) keep the maps, as the fireworks
  scaffold had them · (c) keep a hand-kept successor list for the five tier aliases only
- **taken**: (a). the wisher, 2026-10-02: *"dont keep it if its not relevant for openrouter."*
  - probed live 2026-10-02: all 464 models carry `expiration_date`; 28 hold a date (gemini-2.5
    2026-10-20, qwen3 family 2026-10-09, glm-4.5/4.7 2026-12-31). none of our five pins does.
  - fireworks announced retirement out of band, so a hand map was the only record. openrouter
    publishes the date in the api, and this package accepts any of ~460 ids, which no hand map covers.
  - the legacy map holds renames of OUR slugs; empty, and the package has published none.
- **rework**: clean — both maps were empty; a restore is `git checkout bb9d226 -- <path>`.
- **confidence**: 85% — the wisher's words settle the legacy map; (c) is the one open alternative.
- **where**: atom/slug/, `genBrainAtom`, sdk exports, the three slug briefs.
- **verdict**: —
