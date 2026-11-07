# F12 — a reply cut at the output limit never steps to the next host

- **fork:** (a) step past every defective reply, cut-off included, as issue #13 asks · (b) step
  past empty and prose replies; a `finish_reason=length` reply raises its named error at once
- **taken:** (b). a cut-off reply is the all-thought case (case=2): the host spent the output
  room on thought. the next host gets the same prompt and no cap, so it would spend the same
  thought again and bill it again. the lever is a thought cap, which this tree ships; the error
  names it
- **rework:** clean. one more classifier at one call site in the walk
- **confidence 75%, why low:** a cut-off reply can also be one host's runaway (issue #12's
  "also seen": 131_072 output tokens on a 435k input), where another host would answer short.
  no measurement yet tells the two apart
- **where:** case=9 .the bound; `isReplyEmptyWhereJsonOwed.ts` .note
- **verdict:** —
