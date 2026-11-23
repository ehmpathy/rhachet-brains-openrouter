# F1 — dpdm prod-dep cycles: upstream releases vs an exception

## the fork

the new `test:lint:cycles` fails on `helpful-errors@1.5.3`, which reaches prod `src` through `iso-price`, `with-simple-cache`, and `simple-on-disk-cache`. each is at its latest release. three ways out:

- **A — upstream first.** release `iso-price`, `simple-on-disk-cache`, `with-simple-cache` onto `helpful-errors@^1.7` / `simple-in-memory-cache@0.5.1`, then bump them here. lint goes green honestly. costs four repos and four releases before this pr can merge
- **B — land the upgrade with the cycle check red or skipped.** merge the rest (D1, D2, the ci + husky + jest reshape); track A as follow-up. the `suite / test-lint` required check blocks the merge unless a human overrides it or the cycle step is held back
- **C — exclude in `.dpdmrc.yaml`**, as `rhachet-roles-ghlitch` does. ⛔ forbidden by `rule.forbid.dpdm-exclude-change`. listed so the council sees it was weighed

## taken, and why

none taken. the drive halted. A is the root fix, but it reaches beyond this repo and this route's grants. B is a scope call on what this pr may ship red. both belong to the wisher.

the dev-path cycles (`rhachet` → `declastruct-aws@1.5.2` → `@aws-sdk`) ride the same decision. `rhachet` declares a peer of `declastruct-aws@>=1.10.1` and gets 1.5.2, so a `rhachet` release may clear them.

## rework

dirty. a choice of A holds this pr for days of upstream release. a choice of B ships a red required check or a policy gap others copy, as ghlitch's excludes show.

## confidence: 60%, and why it is low

i am sure C is forbidden and that no in-repo change closes the prod path: each latest release was read via `npm view`. i am less sure the wisher wants A over B. the upgrade's other value (D2 above all, which keeps the repo public) is real and blocked by A.

## where

`.route/v2026_11_23.declapract.upgrade/3.1.repair.test.defects.yield.md` § D3 · dream `.dream/2026_11_23.reseed-helpful-errors-cycle-free-in-cache-and-price-libs.dream.md`

## verdict

A — upstream first, ruled by the director. B is out: no pr merges with a red check. tasks: iso-price#16, simple-on-disk-cache#51, with-simple-cache#70.
