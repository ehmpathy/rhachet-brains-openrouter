# F10 — a local pnpm patch of rhachet mirrors #595, until it releases

- **fork:** (a) patch rhachet 1.48.1 here with #595's types, and ship now · (b) wait for #595 to
  release, then build · (c) declare `effort` only in this package's own ask type, with no patch
- **taken:** (a). the wisher proposed it (2026-10-07). rhachet already passes the ask input
  through untouched (`asBrainAtomWithContextBound.js:20`), so the patch is types only. it proves
  the shape end to end in this repo's tests, and the release later costs a version bump plus a
  patch delete
- **rework:** clean while the patch matches #595. a shape change in review costs one mapping site
  (`effort` → `reasoning`) and the patch file
- **confidence 80%, why low:** rhachet is a peer dependency, so the patch never reaches a
  consumer. bhrain typechecks its call only with the same patch, or after the release. and #595's
  review may rename `budget` or `level`
- **where:** `1.vision.yield.md` .rhachet#595
- **verdict:** —
