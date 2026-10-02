# F7 — drop the session-affinity header

- **fork**: (a) drop `x-session-affinity` and `getOnePromptCacheAffinityKey` · (b) keep it, sent
  to openrouter
- **taken**: (a). it pins a fireworks replica; openrouter's semantics for that header are
  unverified, and an unverified header is a silent no-op at best.
- **rework**: clean — the file returns from git history.
- **confidence**: 80%.
- **where**: vision §package identity.
- **verdict**: —
