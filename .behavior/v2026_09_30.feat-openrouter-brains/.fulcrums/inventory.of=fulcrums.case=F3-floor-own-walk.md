# F3 — `floor` = our own cheapest-first walk

- **fork**: (a) openrouter's `:floor` suffix · (b) `provider.sort = 'price'` · (c) our walk: sort
  the qualified set cheapest-first, send `only: [e]` with no fallback, and on a 429 or fast
  refusal walk to the next endpoint.
- **taken at the first pass**: (b), 65% — it declined `:floor` for a claimed flex-tier side
  effect, unverified. the live probes below overturned (b).
- **taken now**: (c).
- **why, from evidence** (`appendix/research.route-evidence.v2026_10_01.md`):
  - (b) orders the first attempt only. probe 2: OpenInference 429 → AtlasCloud, past 8 cheaper
    healthy endpoints. probe 1: 12 of 12 `sort: price` asks landed on AtlasCloud or Together.
  - (a) picked Relace 10 of 10 — the cheapest prompt rate — but no throttle occurred, so its
    fallback order is unobserved. docs call it a `sort: price` shortcut, so it likely shares (b)'s
    fallback.
  - (c) makes every hop ours: the attempt order is provable. an openrouter-side refusal hop cost
    ~42ms (spike, n=3); a 429 from the upstream host was not measured and costs at least one round
    trip to it.
  - (c) also pins one endpoint per call, which is what lets the proof gate the answer (F14). a pin
    adds no latency of its own; the spike's 426ms vs 1822ms was a host difference.
- **"cheapest" by which rate?** prompt and completion move apart (relace: cheapest prompt, mid
  completion). best guess: rank by a blended rate at the ask's own estimated token mix; tie → p50
  throughput.
- **rework**: clean — the walk is one operation; swap it for `:floor` with no contract change.
- **confidence**: 75%. the wisher asked "isn't `:floor` supported?" — yes; (c) chosen because
  (a)'s fallback cannot be proven.
- **where**: yield §the promises, case=21.
- **verdict**: (c), by the wisher's act 2026-10-01 — "we should dynamically always choose, and
  report", on the walk as built; the agreed review slug runs on it. the rank is this ask's
  estimated cost (F20), ties to higher p50. built today: the walk steps on a 429; the step on a
  fast refusal (404) is owed in execution (case=13 `[t2]`).
