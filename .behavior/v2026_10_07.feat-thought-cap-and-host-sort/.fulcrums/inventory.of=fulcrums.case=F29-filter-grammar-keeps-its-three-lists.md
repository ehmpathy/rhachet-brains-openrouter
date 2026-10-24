# F29 — the filter grammar keeps its three lists

- **fork:** `asSupplyFilters` keeps `FILTER_KEYS`, `VALID_WORDS` and the read chain as three
  lists · one table of `{ key, usage, read }` entries drives all three
- **taken:** three lists, as main has them. `sort` adds one row to each, the same shape every
  prior word took. a table refactor rewrites the parser of every word, which is a change to 0.1.3
  behavior this wish does not ask for, and the sibling latency-filter tree edits the same file
- **rework:** clean — the table is a local refactor with the parser's tests as its guard; it is
  best done once the sibling filter trees have landed, so it is not rebased three ways
- **confidence 75%, why low:** a word added to one list and not the others compiles clean; the
  unit tests catch it for each word they cover, not for a word with no test
- **where:** `asSupplyFilters.ts`
- **verdict:** —
