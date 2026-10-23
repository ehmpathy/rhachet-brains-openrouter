# fix(supply): a host fault walks to the next host

closes #21. #22 and #23 ride a follow-up tree.

## what changes for the caller

### 1. a host fault no longer fails the ask, on either supply path

one seam, `asHostFault`, reads every thrown error and returns `throttled` (429), `refused` (404),
or `failed` (a 400 that openrouter marks as the host's) — or null, which rethrows untouched.

- **admitted set** (a filtered slug, no `floor`) — before: one send, `allow_fallbacks: false`, so
  a 429 from the host openrouter picked failed the ask (#21). now:
  - a fault that names an admitted host drops that host and re-sends to the rest
  - a fault openrouter marks as a host's (`Provider returned error`) that names no admitted host
    walks the set one endpoint per send (#21's own `429 Provider returned error`)
  - a fault with no host mark — openrouter's normalized `429 Rate limit exceeded` (its account
    limit) or a bare 404 — rethrows untouched after one send; no other host can fix it
- **floor walk** — a host 400 now steps to the next endpoint, as a 429 and a 404 already did
- **both paths** — a 404 drops the model's cached endpoint list; a caller's own 400 (no host
  mark) still fails at the first send

### 2. the exhausted refusal says more

once every qualified endpoint faulted, both paths throw the same `MalfunctionError`, which now:

- carries the last host's own error as `cause` (status, headers, body readable)
- shows `last host fault: <reason>` (the host's reason, cut to 300 chars)
- names openrouter's `retry-after` in the fix line, and names the request ("fix the request")
  only after a host 400 — a throttle or a refusal never blames the request
- speaks only of the last host: when it failed mid-reply or answered prose, it threw no error, so
  no earlier host's reason or `cause` is shown as the last

## ⚠️ behavior change: `supply.attempts` on the admitted path

`supply.attempts` now lists each endpoint tried in both supply modes, and its last row is the
serve: `{ tag, outcome: 'served' }`.

- admitted path, first-try serve: `[]` → `[{ tag, outcome: 'served' }]`
- a consumer that checks `attempts.length === 0` for "no hop" must check
  `attempts.every((a) => a.outcome === 'served')` instead

the hops are silent on success; log `supply.attempts` to see why an ask ran slow.

## ⚠️ behavior change: the admitted path's error class, once every host faults

- before: a 429 or host 400 reached the caller as the raw `RateLimitError` / `APIError`
- now: a hop that empties the set throws `MalfunctionError`, and `cause` holds the last host's
  original error (status, headers, body)
- a caller that branches on `instanceof OpenAI.RateLimitError` or `.status` must read
  `error.cause` instead. an unmarked fault (openrouter's own limit) still rethrows raw

## needs your call: two wish phrases read on a best guess, and one deferral

- **"honor `retry-after`"** — read as: report it in the refusal (`fix: retry after Ns`), and let
  the openai client wait it out on its own retries; the hop itself does not sleep before the next
  host (F9 fork 1, 80%). rework clean: a sleep before the next send
- **"the same funnel render"** — read as: the same refusal render the floor walk throws (the hop
  trail), not the qualification funnel; `supply.choice.funnel` reaches the caller only on success
  (F2, 75%). rework clean: pass the funnel into `getOneFloorExhaustedError`
- **no live status while a hop waits** — a throttled host can hold `brain.ask` silent for about a
  minute (two, after a marked fault with no host name); the hops show only after, in
  `supply.attempts`. the floor walk already waited this way. deferred: a log channel is a new
  `brain.ask` context field (F12, 75%). rework clean: an optional `log`, one line per hop —
  [dream](.dream/v2026_10_21.observe.hop-status-while-it-waits.md)

## needs your approval: two questions, from tests whose intent traces to a design decision

### Q1 — what does `supply.attempts` hold on a first-try serve?

the extant tests asserted `attempts` toEqual `[]` on a first-try admitted serve (live
`genBrainAtom.supply` [case6], `getOneSuppliedCompletion` unit), and the floor walk's own trail ended
`{ tag, served }` (`getOneFloorCompletion` [case1–3, 6–8]). #21 adds hops to the admitted set, so
the report must name them, and the vision cell c14 had to pick one shape for both modes.

| option | first-try serve | after a hop | cost |
|---|---|---|---|
| **A — every send, last row is the serve (taken)** | `[{ tag, served }]` | `[{ a, throttled }, { b, served }]` | a consumer that tests `attempts.length === 0` for "no hop" breaks (see § behavior change) |
| B — faults only | `[]` | `[{ a, throttled }]` | the extant tests stand; the served host is read from `supply.provider`, not the trail; the floor walk drops its own `served` row to match |
| C — A, plus a `hops` count | `[{ tag, served }]`, `hops: 0` | as A, `hops: 1` | a new `SupplyReport` field |

**lean: A.** one rule for both modes, and the trail alone tells the whole story of an ask. the
live [case6] check reads "the last row is served; each row before it is a step `FloorAttempt`
names", since a live host may throttle and a live suite cannot promise no hop. its [t1] ties the
trail to the completion sends: a recorded hop with one fetch goes red, so a phantom hop on every
ask cannot pass. the unit grain asserts each exact trail. record: F15. rework to B is clean
(the composer's one append line, and the tests revert).

### Q2 — what does the exhausted refusal call a host 400?

the extant snapshots read headline `failed mid-reply`, with no reason in the metadata
(`getOneFloorExhaustedError` throttle and no-throttle snaps, `getOneFloorCompletion` [case4]).

| option | headline | metadata | cost |
|---|---|---|---|
| **A — reuse `failed`, widen the headline (taken, F3 + F10)** | `failed (mid-reply or with its own error)` | `faultReasonLast` | three extant snapshots reword |
| B — a new outcome word for a host 400 (e.g. `rejected`) | `failed mid-reply` stays; a new row word | `faultReasonLast` | a new `FloorAttempt` outcome every consumer must handle |

**lean: A.** a host 400 and a mid-reply fail both mean "this host could not serve this ask"; a
caller acts the same on each, and the reason line tells them apart. rework to B is clean.

the live test's timeout (90s → 180s) follows F9 (the client keeps its own retries, so one hop can
cost about a minute); it stands or falls with § F9 below.

## verification repairs: extant tests whose instrument was defective

each row kept what the test proves and replaced how it measures, since the old instrument failed
with no defect in the code. no design decision rides on these.

| test | proves | old instrument, and its measured defect | new instrument |
|---|---|---|---|
| acceptance no-spend cases ([case4] typo, [case6] zero-qualified, [case9] json-schema) | a refused ask spends no credit | the key's `/key` usage before vs after: one meter for the whole key; it moved 198.067 → 198.042, 207.853540 → 207.853557, and 207.895 → 207.887 across refused asks with no send, even after a settled read | the `/chat/completions` sends of the ask, via a `fetch` spy (observe only), `toEqual(0)`; control [case3b] asserts a served ask counts `≥ 1`, so a blind spy goes red |
| acceptance zero-qualified refusal snapshot | the refusal names the model the tier resolved to | the exact id `deepseek/deepseek-v4.1-flash` in the snapshot; openrouter shipped `-1017` and the snapshot broke with no change here | the exact id read from `getOneTierModel`, the call the ask itself made (its held pick); the headline must name it, and the snapshot masks only that id |
| `sdkOpenRouterEndpoints.integration.test.ts` [case2] | a warm read is cheap and makes no network read | 50ms of wall-clock on a disk-cache read: 329ms for one read, then 57ms for the fastest of five, under parallel suites, and 274ms for a read with 257ms of it in the cpu run queue on a host at load average 73 / 12 cores | every one of ten reads under 50ms of wall-clock less the js thread's run-queue wait (`/proc/self/task/<pid>/schedstat`); an i/o stall still counts (an 80ms sleep in the window goes red); plus `fetchCalls === 0` (F18) |

## the vision catalog changed with the code

review found the code had outrun the vision. the catalog in
`.behavior/v2026_10_21.fix-429-hop-and-tier-fallback/` was evolved to match:

- c9 — narrowed to the unmarked fault, which rethrows in one send
- c10 — a fault that names a host outside the set now walks (was: rethrow)
- c15 — new: a marked fault with no name walks host by host, then serves
- c14 — `attempts` ends on `served` in both modes
- c16 — new variant: a provider that owns several endpoints drops all of them in one hop, one
  trail row per endpoint
- invariant I2 and the dimensions restated; 26 cells in 14 rows

## F9, client retries on hop sends — kept (robot:director, best guess, 70%)

the openai client retries each send twice and waits out a `retry-after` under 60s in full, before
the hop sees the 429. so a throttled host that asks for 30s costs about a minute before the next
host is tried. the lever is `{ maxRetries: 0 }` per send while a hop remains — it trades the
client's recovery from a transient 429 for a faster hop. kept for this PR: #21 is the hop; a
retry cut is a separate latency change with no measurement yet, and 5xx is not yet in
`asHostFault`, so a non-last endpoint would lose its retry. the measured cut is a
[dream](.dream/v2026_10_21.measure.retry-cut-on-hop-sends.md) for tier-fallback-and-speed-waiver. record:
`.behavior/v2026_10_21.fix-429-hop-and-tier-fallback/.fulcrums/inventory.of=fulcrums.case=F9-retry-after-reported-not-waited.md`

## coverage

- `asHostFault.test.ts` — the decision, data-driven, incl. the live 2026-10-21 400 capture
- `getOneAdmittedSetCompletion.test.ts`, `getOneFloorCompletion.test.ts` — each hop, walk,
  rethrow, cache drop, and refusal, messages snapshotted
- `getOneSuppliedCompletion.integration.test.ts` — a real `OpenAI` client over a local http stub
  pins the field paths, the client's retries, and the full send trail per fault shape
- `genBrainAtom.supply.integration.test.ts` — live; each hop must be a host fault, last = served
- each defect clamp proven to go red with its fix reverted
- acceptance `[case1b]` (a tier chosen by discovery) is no longer skipped: it runs discovery in a
  plain `node` child, since jest's vm refuses rhachet's dynamic `import()`
- acceptance `[case2b]` — a no-floor composite asked live; its supply report is snapped beside
  the floor's
- `getOneSuppliedCompletion.test.ts` [case1b–e] — the composed floor trail: a throttle, a refusal
  (404), a host 400, and a json ask answered in prose, each then the serve
- `genBrainAtom.supply.integration.test.ts` [case6] [t1] — the live trail under a send counter
- full suite on the final tree, `rhx git.repo.test --what all --against local --env test --mode apply --thorough`,
  each part on the final tree: unit 461, integration 159, acceptance 61 passed, 0 failed,
  0 skipped; types, lint, format pass

## deferred, as dreams

- [hop at the `brain.ask` grain](.dream/v2026_10_21.coverage.hop-at-the-brain-ask-grain.md)
- [one walk over endpoint groups](.dream/v2026_10_21.refactor.one-walk-over-endpoint-groups.md)
- [rename `FloorAttempt` → supply attempt](.dream/v2026_10_21.rename.floor-attempt-to-supply-attempt.md)
- [capture a live 429 body](.dream/v2026_10_21.evidence.capture-a-live-429-body.md)
- [empty reply after a long think](.dream/v2026_10_21.evidence.empty-reply-after-long-think.md) — the transport half of host faults
- [show a hop while the caller waits](.dream/v2026_10_21.observe.hop-status-while-it-waits.md) — F12

## also in this PR (chore commit)

- rhachet 1.48.0 → 1.50.0; roles bhrain 0.38.0 → 0.42.1, bhuild 0.21.36 → 0.23.3,
  ehmpathy 1.39.1 → 1.39.7
- `.claude` retargeted to `.agent/.actors/actor.via.repo=ambient/`; `.gitignore` and
  `.depcheckrc.yml` follow
- `.gitignore` holds `.patch` and `.radio`: machine-local state (a held pnpm patch, a radio-queue
  symlink) that must never land in a commit

🤖 Generated with [Claude Code](https://claude.com/claude-code)
