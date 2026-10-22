# F30 — the routine `rhachet-roles-*` dev bumps ride the commit

- **fork:** the `rhachet-roles-*` dev dependency bumps in `package.json` ride this commit · they
  are split into their own commit or reverted
- **taken:** they ride. they are the normal churn of a repo that upgrades its tools, and
  `rule.require.git-release-confidence` (mechanic) files them in scope by default: "a split of
  routine bumps into a separate release is churn, not caution". they are dev-only, so no consumer
  installs them, and the gates cover a bad bump
- **rework:** clean — a revert of the version lines and a lockfile refresh
- **confidence 85%, why not higher:** a reviewer named them out of this behavior's scope, and the
  squash makes one release entry, so a bump cannot be reverted apart from the feature
- **where:** `package.json`, `pnpm-lock.yaml`
- **verdict:** —
