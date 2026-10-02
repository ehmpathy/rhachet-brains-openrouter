# F28 — `atom/` imports `route/` directly; both are subdomains of one bounded context

- **fork**:
  - (a) `atom/` imports `route/` operations by path, one-way
  - (b) a `route/` contract file (an index or a `shared/` module) that `atom/` imports through
  - (c) merge `route/` into `atom/`
- **taken**: (a).
  - the package holds ONE bounded context: an openrouter brain. `atom/` is its brain surface;
    `route/` is how that brain reaches a host. one ubiqlang (slug, filter, endpoint, pin), one
    owner, one release
  - `rule.forbid.scope-leaks` and `rule.require.bounded-contexts` guard a boundary between
    contexts (its own example is `job/` vs `invoice/`, two domains). within one context a
    subdomain may compose another — `rule.prefer.most-common-denominator` nests by use, it
    does not wall
  - the edge is one-way, checked 2026-10-02: `grepsafe "from '../atom"` in `route/` → 0 hits.
    `atom/` → `route/` is 7 imports. no cycle
  - (b) is a barrel or forwarder, forbidden (`rule.forbid.barrel-exports`), and it adds a hop
    with no new seam: every `route/` operation the atom calls already takes its sdk by context
    (`getOneRoutedCompletion`, `getOneCatalogModel`)
  - (c) would bury the route grammar under the atom, where a second consumer (a future
    brain.repl) would have to reach into `atom/` for it
- **rework**: clean — a directory move, done by `mvsafe` plus one sedreplace of import paths.
- **confidence**: 80%. if a second brain surface lands, `route/` may earn its own package.
- **where**: `src/domain.operations/atom/*` imports of `../route/*`.
- **raised by**: arch-smell-scopeleaks, 5.1 i003 blocker.1.
- **verdict**: —
