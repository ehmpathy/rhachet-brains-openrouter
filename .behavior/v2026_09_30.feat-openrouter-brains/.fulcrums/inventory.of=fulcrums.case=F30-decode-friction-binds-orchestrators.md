# F30 — decode-friction binds orchestrators; a named transformer's body is where its logic lives

- **fork**:
  - (a) extract the logic out of orchestrators; leave each named transformer's body as written
  - (b) also split every transformer body into further named transformers, until no body holds
    a ternary, a `??`, a regex, a map, or a join
- **taken**: (a).
  - `rule.forbid.inline-decode-friction` reads: *"forbid decode-friction inline in
    orchestrators"* and *"decode-friction inline in orchestrator = blocker"*. the twin,
    `rule.require.named-transformers`, says *"extract decode-friction logic into named
    transformers"* — the transformer is the destination, not a further target
  - `define.domain-operation-grains`: a transformer IS where *"decode-friction logic + format
    conversion"* lives. `asOpenRouterEndpoints`, `asProviderPreference`, `asOpenRouterExtras`,
    `getAllSimilarModelIds`, the `getOne*Error` builders — each is already the name the rule asks
    for, and its body is the one place a reader goes to see the how
  - (b) recurses without a floor: a `?? null` field cast extracted to `asEndpointTag` holds a
    `??` itself. it trades one legible body for several one-line files, which
    `rule.prefer.wet-over-dry` warns against
  - the orchestrators the lane named are repaired: `genBrainAtom` (messages, size, prompt text),
    `getOneRoutedCompletion` (`asRouteFactsFromReply`), `getOneFloorCompletion`
    (`getOneCompletionFromEndpoint`, `getOneFloorExhaustedError`), and the shared schema
    classifier (`isStringLikeJsonSchema`)
  - the same lane graded the identical codebase **1 nitpick** at i003 and **17 blockers** at i004,
    and the extra 16 sit almost wholly inside transformer bodies. no harm ships from any of them
    (`rule.forbid.overzealous-blockers`)
- **rework**: clean — any one transformer body can be split further in place.
- **confidence**: 85%.
- **where**: the transformer files named in mech-decode-friction i004.
- **raised by**: mech-decode-friction, 5.1 i004, blockers 1, 4–6, 8–12, 14–17 and nitpicks 1–7.
- **verdict**: —
