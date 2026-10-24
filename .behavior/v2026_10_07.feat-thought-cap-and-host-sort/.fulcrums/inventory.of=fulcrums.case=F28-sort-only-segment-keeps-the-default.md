# F28 — a sort-only filter segment keeps the default promises

- **fork:** a slug's own segment replaces the default whole, `sort` too · a segment of `sort`
  alone merges onto the default · a segment of `sort` alone is refused, with the full spelling
- **taken:** merge. `openrouter/deepseek/flash/sort=throughput` resolves to the default
  (`floor&speed=min50tps&privacy=full`) plus `sort: throughput`. `sort` orders hosts; it never
  admits or excludes one, so it is no promise of its own and cannot stand in for the default's.
  a segment with any promise word (`region=usa&sort=throughput`) still replaces the default whole,
  as in 0.1.3
- **why not refuse:** a refusal is safe, but the caller's intent ("the default, fastest first") is
  plain, and the merge serves it with no surprise. two reviewers (r010, r011, i006) named the drop
  of `privacy=full` as the harm; both offered merge or refuse
- **rework:** clean — one branch in `asAtomTarget` (`isSortOnlyFilters`); a switch to refuse is a
  throw in the same place
- **confidence 80%, why not higher:** it is the one case where a slug's own segment does not
  replace the default, so the grammar gains an exception the readme must state (it does). and
  `region=usa` alone still drops `privacy=full`, a 0.1.3 trap this change leaves as it was
- **where:** `asAtomTarget.ts`, `isSortOnlyFilters.ts`, `readme.md` (`### sort, beside the other words`)
- **verdict:** —
