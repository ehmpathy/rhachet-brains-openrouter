# F2 — `"private": false` set by hand on the declapract backfill

## the fork

declapract backfilled `"private": true`. keep it (fail closed, as the practice prefers), or set `"private": false`.

## taken, and why

`"private": false`. the repo is public (`gh repo view`), and the package publishes to npm. `true` would make provision flip the repo private and make `npm publish` refuse. the practice readme names `false`, by hand, as the move for a public published package.

## rework

clean. one key in `package.json`; no other file leans on it yet.

## confidence: 95%, and why not higher

the only doubt is intent: whether the owner now wants the repo private. every signal on record says public — 0.1.4 on npm, a public repo, a publish workflow.

## where

`package.json` · `3.1.repair.test.defects.yield.md` § D2

## verdict

awaited; offered as a clean rework if the owner prefers private.
