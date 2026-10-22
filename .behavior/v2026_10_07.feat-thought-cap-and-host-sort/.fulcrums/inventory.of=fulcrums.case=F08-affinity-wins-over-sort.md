# F08 — affinity pin wins over host sort

- **fork:** affinity first, sort orders the fallbacks · sort first, affinity ignored · refuse both together
- **taken:** affinity first. a cache read of a long prefix saves input cost and prefill time.
  no throughput gap on a short verdict outweighs both. the sort still orders the fallbacks
- **rework:** clean. it is one precedence in the queue comparator, and neither tree has code yet
- **confidence 85%:** the wish asks only that the winner be named
- **where:** case=5, `.composition`
- **verdict:** —
