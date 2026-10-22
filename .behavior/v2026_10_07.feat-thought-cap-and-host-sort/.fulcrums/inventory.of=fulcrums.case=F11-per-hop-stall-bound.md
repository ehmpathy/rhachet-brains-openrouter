# F11 — the per-hop stall bound: a fixed, generous 10 minutes

- **fork:** (a) a fixed bound per hop, 10 minutes · (b) derived per ask: (effort budget + answer
  room) ÷ the slug's min tps, times a margin · (c) caller-set on the ask
- **taken:** (a). a bound exists to end a dead host, not a slow answer; the thought cap is the
  lever for a slow answer. (b) has no input when effort is unset, the 0.1.3 default, and the
  output room can reach 943_718 tokens, so the formula yields hours. (c) adds a third per-ask
  knob that rhachet's contract does not carry
- **rework:** clean. one constant, read at one abort race
- **confidence 60%, why low:** an honest unbounded-thought answer can run past 10 minutes at a
  50 tps floor (30k tokens), and the bound would cut it. the measured stalls ran 21 minutes with
  no reply, so the figure is a guess between the two
- **where:** `1.vision.yield.md` .the walk survives a cut or stalled host; case=9
- **verdict:** —
