# F35 — module constants keep the upper snake form, acronyms included

- **fork**:
  - (a) rename every upper-snake constant to camel case (`zdrFreshMs`, `apiKey`, …)
  - (b) keep the upper snake form for module constants; `rule.forbid.shouts` binds acronyms
    inside camel names, filenames, and prose
- **taken**: (b), at 5.3 i001 (peer r006 blocker.2 asked for (a)).
  - the upper snake form is this repo's declared name for a module constant:
    `define.brain-config-pattern` names `CONFIG_BY_ATOM_SLUG` itself, and the inherited
    `SLUGS_PROMISED_FOREVER`, `PINNED_BY_LATEST_SLUG`, and `TEST_CASES` follow it
  - the rule's own examples are acronyms in camel names (`parseJWT` → `parsejwt`) and in
    filenames. none is a constant. a `ZDR_` prefix reads as part of a constant, not as a shout
    inside a word
  - (a) would rename about twenty names across nine files, and every brief that cites
    `CONFIG_BY_ATOM_SLUG` too, or split the convention in two
- **rework**: clean — `sedreplace` per name, if the council rules (a).
- **confidence**: 80%.
- **where**: `route/getAllZdrTagsByModel.ts`, `route/asRouteFilters.ts`, `atom/slug/AtomSlug.unlisted.ts`, and six test files.
- **raised by**: the driver, at peer r006.
- **verdict**: —
