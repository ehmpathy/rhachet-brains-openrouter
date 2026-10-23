# F18 — the warm-cache bound reads two clocks: wall-clock, fastest of ten spaced reads; cpu, every read

## .the fork
1. **one read, wall-clock, under 50ms** — the extant assertion
2. **one read, cpu, under 50ms** — load-proof; blind to an i/o stall
3. **wall-clock, fastest of ten reads spaced 200ms apart, under 50ms; and cpu under 50ms on
   every read** — both clocks
4. **1, with the integration suite run serially** (`--runInBand`)

## .taken: 3, and why at the time
the cache lives on disk, so a warm read is a file read and a parse. the wall clock counts the
host's load too: one read took 329ms while two live suites shared the cpu, then the fastest of
five back-to-back reads took 57ms in a full run, and every read was under 50ms alone.

- option 1 fails on load, not on the cache
- option 2 is blind to a disk stall (the r12 point)
- option 4 slows the whole live integration suite to cure one assertion, and edits a shared jest
  config that the repo's template owns
- option 3 keeps "returns within 50ms" as a wall-clock fact: a slow cache or a stalled disk
  slows all ten reads, and no brief spike covers ten reads spread over two seconds. the cpu bound
  holds on every read, so slow work on any one read fails

raised by 5.3 peer lane r12 (blocker.6, i008 and i010).

## .rework: clean
option 4: `runInBand` for integration, and restore option 1.

## .confidence: 75%, and why it is not higher
a disk stall on some reads but not all would pass the wall-clock check (the cpu check would
not see it either).

## .where
`src/domain.operations/supply/sdkOpenRouterEndpoints.integration.test.ts` [case2]

## .verdict
superseded at i012 (peer r12) by a fifth option, measured: every read of ten under 50ms of
wall-clock less the javascript thread's run-queue wait (`/proc/self/task/<pid>/schedstat`). the
cause of the red was host load (load average 73 on 12 cores; 257ms of one 274ms read sat in the
run queue, ~10ms on cpu), which `--runInBand` cannot cure since other processes set it. an i/o
stall still counts: an 80ms sleep in the window went red
