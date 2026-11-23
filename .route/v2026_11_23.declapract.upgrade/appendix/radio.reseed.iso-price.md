## .what

bump `helpful-errors` 1.5.3 → 1.7.6, then release.

## .why

`helpful-errors@1.5.3` holds a require cycle (`HelpfulError.js` ↔ `withHelpfulError.js`). upstream `helpful-errors` fixed it in 1.7.x. the declapract-typescript-ehmpathy practice `test:lint:cycles` (dpdm, `exclude: []`) walks prod deps, so every consumer of `iso-price` fails lint. `rule.forbid.dpdm-exclude-change` forbids an exclude of a prod dep, so the fix must land here.

evidence: `pnpm why helpful-errors@1.5.3 --prod` in ehmpathy/rhachet-brains-openrouter, branch `beav/feat-declapract-upgrade`. `iso-price@1.2.0` (latest) pins `helpful-errors: 1.5.3`.

## .done when

- an `iso-price` release depends on `helpful-errors@^1.7`
- dpdm over a consumer reports no `helpful-errors` cycle
