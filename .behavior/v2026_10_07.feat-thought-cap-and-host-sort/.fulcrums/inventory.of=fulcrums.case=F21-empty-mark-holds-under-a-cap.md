# F21 — an empty `stop` reply marks its host for 7 days, cap or no cap

- **fork:** mark an empty reply whatever the ask sent · skip the mark when the ask carried a
  thought cap · key the mark on whether a cap was sent
- **taken:** mark it, cap or no cap. an all-thought reply ends `length` (q2, measured on deepseek
  flash), and `length` is never a host failure (F12), so it never marks. an empty reply that
  ends `stop` sent no thought-limit signal, so its host broke the json promise on its own clock.
  a skip under a cap was built on the i005 review and reverted on the i006 review: its reason
  ("the cap may have spent the room") contradicts the code, since a spent room ends `length`.
  and it would spare the very host issue #24 names (Morph: 24–28k output tokens, then 0 chars)
  on every capped ask, which is every bhrain review lane
- **rework:** clean — one guard in `setFailureNoted`
- **confidence 75%, why low:** q2 stays open for hosts other than those probed. if one host ends
  an all-thought reply with `stop`, a capped ask would mark a healthy host for a week
- **where:** `setFailureNoted.ts`, `isReplyEmptyWhereJsonOwed.ts`; clamped on a real socket by
  `getOneFloorCompletion.socket.integration` [case4]
- **verdict:** —
