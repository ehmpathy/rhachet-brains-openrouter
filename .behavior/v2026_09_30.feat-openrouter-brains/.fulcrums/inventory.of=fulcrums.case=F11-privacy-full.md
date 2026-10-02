# F11 — `privacy=full` maps to the zdr list, with both native flags

- **fork**: (a) `data_collection: 'deny'` · (b) `zdr: true` · (c) qualified set ⊆ `/endpoints/zdr`
  for the model, plus both native flags, plus a post-call check · (d) two words: `retain=none`,
  `train=no`.
- **taken**: (c), one word. the wisher named it: "privacy=full -> no retention, no [model train]".
- **why**: probe 1 — `data_collection: 'deny'` served AtlasCloud ×2, which is **off** the zdr
  list, so (a) does not stop retention. `zdr: true` held the list (Together, DeepInfra). zero
  retention also rules out model train on prompts, so one list answers both halves.
- **what it rests on**: openrouter's zdr list is openrouter's statement of each provider's policy.
  this package proves the endpoint was on that list; it cannot prove the provider honors it.
  the readme says so.
- **rework**: clean.
- **confidence**: 80%.
- **where**: yield §the promises, case=5.
