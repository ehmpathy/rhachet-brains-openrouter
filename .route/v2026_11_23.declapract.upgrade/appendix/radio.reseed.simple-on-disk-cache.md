## .what

bump `simple-in-memory-cache` 0.4.2 → 0.5.1, then release.

## .why

`simple-in-memory-cache@0.4.2` → `domain-objects@0.31.9` → `helpful-errors@1.5.3`, which holds a require cycle (`HelpfulError.js` ↔ `withHelpfulError.js`). `simple-in-memory-cache@0.5.1` already moved to `helpful-errors@1.7.3`, where the cycle is gone. the declapract-typescript-ehmpathy practice `test:lint:cycles` (dpdm, `exclude: []`) walks prod deps, so every consumer of `simple-on-disk-cache` fails lint. `rule.forbid.dpdm-exclude-change` forbids an exclude of a prod dep.

evidence: `pnpm why helpful-errors@1.5.3 --prod` in ehmpathy/rhachet-brains-openrouter, branch `beav/feat-declapract-upgrade`. `simple-on-disk-cache@1.8.1` (latest) pins `simple-in-memory-cache: 0.4.2`.

## .done when

- a `simple-on-disk-cache` release depends on `simple-in-memory-cache@0.5.1` (or later)
- `with-simple-cache` can then bump onto it (see the peer task in ehmpathy/with-simple-cache)
