# F8 — the admitted-set 429 hop rests on openrouter's marked shape, which names the host

- **fork**: a 429 reaches the admitted set in one of two shapes. which does the hop key on?
  - (a) the **marked** shape: message `Provider returned error`, `metadata.provider_name` names the host. this is the form of the live 2026-10-21 400 capture, and #21 observed this marker on its 429 (`429 Provider returned error`, rhachet-roles-bhrain CI, 2026-10-17)
  - (b) the **normalized** shape in openrouter's errors doc (fetched 2026-10-21): message `Rate limit exceeded`, `metadata.error_type: rate_limit_exceeded`, no host name. a host is named there only via `openrouter_metadata`, which needs the `X-OpenRouter-Metadata` request header
- **taken**: (a) hops: a named host is dropped and the rest re-sent; a marked 429 with no name walks the set one endpoint per send (F4, vision c15). (b) rethrows untouched in one send, per vision c9: it is openrouter's own account limit, which no other host can lift; a walk would cost up to 3(N+1) sends, prolong the limit, and blame hosts for it in the refusal
- **evidence**:
  - the #21 message text is the marked shape's message
  - the live 400 capture shows that marker carries `provider_name`
  - a real `OpenAI` client over local http pins the field paths each shape is read from (`getOneSuppliedCompletion.integration.test.ts`)
  - no live 429 body is captured; a throttle cannot be forced on demand
- **clamps**:
  - (a) hops: admitted [case2], [case4], [case8]; real-client [case1], [case3]
  - (a) marked, unnamed, walks: `asHostFault.test.ts` "marked throttle", admitted [case12], real-client [case4]
  - (b) rethrows: `asHostFault.test.ts` "documented normalized shape", admitted [case7] t0, real-client [case2] (full send trail)
- **rework**: clean. (b) can gain a host name later: send `X-OpenRouter-Metadata` and read `openrouter_metadata` as a second source inside `asHostFault`
- **confidence**: 85% — the 429 body is inferred from the marker, not captured. #21's own message is the marked shape, so #21 hops or walks either way
- **follow-up**: `.dream/v2026_10_21.evidence.capture-a-live-429-body.md`
- **raised by**: 5.1 peer `enroll-impl-behavior-intent`, i004 blocker.1, i005 blocker.1 and its fourth point
- **verdict**: —
