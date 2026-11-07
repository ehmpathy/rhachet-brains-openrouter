# F03 — under `floor`, sort reorders the walk rather than refuses

- **fork:** (a) sort reorders the floor walk · (b) sort is refused with `floor`, so the caller
  must write a filter segment with no `floor` · (c) sort is forwarded as `provider.sort` only,
  which does naught with one host in `only`
- **taken:** (a), with (c)'s forward kept beside it. every tier slug defaults to `floor`. (b)
  would refuse sort on every bare slug. (c) alone is a silent no-op, but the forward keeps the
  wish's "forwards it as `provider.sort`" literal, and it costs naught
- **rework:** clean. it is the ranked queue's comparator
- **confidence 70%, why low:** "floor" claims cheapest. under sort it no longer is, and only the
  report says so
- **where:** case=4, `.what is awkward`
- **verdict:** —
