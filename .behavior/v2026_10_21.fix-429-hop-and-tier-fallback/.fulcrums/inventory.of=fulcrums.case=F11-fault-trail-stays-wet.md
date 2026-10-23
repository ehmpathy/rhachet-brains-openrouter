# F11 — the fault-trail update and the error-body narrowers stay wet

- **fork**: two consolidations a reviewer proposed
  - (a) one `asTrailAfterFault` transformer for each walk's catch: the `attempts` append, `retryAfter ?? prior`, `faultLast`
  - (b) one `asOpenRouterErrorBody` that narrows `error.error` once, for `asProviderName`, `isProviderErrorMarked`, and `asHostFaultReason`
  - (c) keep both inline, as they are
- **taken**: (c). each is two or three sites, under the rule of three (`rule.prefer.wet-over-dry`). the two catches differ in shape: the floor walk appends one tag, the admitted set appends each endpoint of the named provider, and only the admitted set falls back to a walk. one transformer would take a switch on the mode, which that rule names as the sign of a premature abstraction
- **the cost (c) keeps**: F7's "latest wins" rule sits in two `??` expressions; a change to it touches two lines
- **when to lift**: #22/#23 add a third fault path (F1), and the dream that reads `openrouter_metadata` adds a second name source. either is the third use that earns (a) or (b)
- **rework**: clean — pure transformers, no contract change
- **confidence**: 80%
- **where**: `getOneFloorCompletion`, `getOneAdmittedSetCompletion`, `asHostFault`, `asHostFaultReason`
- **raised by**: 5.1 peer `enroll-impl-arch-defects`, i005 third and fourth points
- **verdict**: —
