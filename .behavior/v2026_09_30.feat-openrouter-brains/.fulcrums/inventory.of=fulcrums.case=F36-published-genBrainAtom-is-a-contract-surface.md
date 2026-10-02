# F36 — the published `genBrainAtom` and the readme probe are contract surfaces an acceptance test may drive

- **fork**:
  - (a) acceptance actions only via `genContextBrain` over `getBrainAtomsByOpenRouter()`; move
    the `genBrainAtom` cases and the readme probe out to integration suites
  - (b) acceptance actions via any export of the BUILT package, imported by its own name
    (`rhachet-brains-openrouter`), and via the readme's own probe run against that build
- **taken**: (b), at 5.3 i001 (peer r009 blocker.1 and nitpick.1 asked for (a)).
  - `genBrainAtom` is a public export of the package. the acceptance file imports it from
    `rhachet-brains-openrouter`, the self-link to `dist/`, never from `domain.operations/`.
    `rule.require.acceptance.blackbox` forbids an action through an INTERNAL operation; this is
    the published one
  - an unlisted id, or a filter beyond the preferred floor, is not in the registry today (F5), so
    `genContextBrain` cannot choose it. `genBrainAtom` is the documented path for those (readme,
    case=6, case=20), so the acceptance suite must drive it, or those journeys lose their only
    blackbox proof
  - the readme probe is the first command a stranger runs. it runs `node -e` with the readme's
    own text, against the built package. that is the contract as a stranger meets it (case=1)
- **rework**: clean — once the reseed lands pattern atoms (F5), the unlisted-id cases move to
  `genContextBrain` choices.
- **confidence**: 85%.
- **where**: `contract/sdk/getBrainAtomsByOpenRouter.acceptance.test.ts` [case3–case7]; `contract/readme.acceptance.test.ts`.
- **raised by**: the driver, at peer r009.
- **verdict**: —
