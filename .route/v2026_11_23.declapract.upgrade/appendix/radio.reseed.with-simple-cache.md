## .what

bump `simple-in-memory-cache` 0.4.2 → 0.5.1 and `simple-on-disk-cache` onto its next release, then release.

## .why

`simple-in-memory-cache@0.4.2` → `domain-objects@0.31.9` → `helpful-errors@1.5.3`, which holds a require cycle (`HelpfulError.js` ↔ `withHelpfulError.js`). `simple-in-memory-cache@0.5.1` already moved to `helpful-errors@1.7.3`, where the cycle is gone. the declapract-typescript-ehmpathy practice `test:lint:cycles` (dpdm, `exclude: []`) walks prod deps, so every consumer of `with-simple-cache` fails lint. `rule.forbid.dpdm-exclude-change` forbids an exclude of a prod dep.

evidence: `pnpm why helpful-errors@1.5.3 --prod` in ehmpathy/rhachet-brains-openrouter, branch `beav/feat-declapract-upgrade`. `with-simple-cache@0.17.3` (latest) pins `simple-in-memory-cache: 0.4.2` and `simple-on-disk-cache: 1.7.10`.

## .order

after ehmpathy/simple-on-disk-cache releases onto `simple-in-memory-cache@0.5.1`.

## .done when

- a `with-simple-cache` release reaches no `helpful-errors@1.5.3` via `pnpm why`
