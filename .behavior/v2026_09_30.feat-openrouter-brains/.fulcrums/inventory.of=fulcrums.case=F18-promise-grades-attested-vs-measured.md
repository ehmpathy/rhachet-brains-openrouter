# F18 — promise grades: attested vs measured vs proven

**fork:** keep `privacy`, `region`, `precision` under B = `measured` beside `speed`, or split them into `attested`.

**taken:** split. raised by the wisher 2026-10-01: *"who verifies privacy=full? who verifies that they do what they advertise?"*

| word | source of truth | grade |
|---|---|---|
| `price.max`, `floor` | the bill (`usage.cost`) | proven, after |
| `speed` | openrouter's observed `throughput_last_30m` | measured |
| `precision` | the provider's declared quantization | attested |
| `privacy=full` | the provider's terms, as screened onto openrouter's zdr list | attested |
| `region=usa` | the provider's endpoint tag | attested (F14) |

we enforce the pin to a listed endpoint and check the served provider. no client can observe what a provider retains, or where its hardware sits. recourse for a broken attestation is contractual, never technical.

**rework:** clean — a vision axis value rename plus the word "attested" in refusal and description text.

**confidence:** 85% — the grades are facts; open only whether the wisher wants the word surfaced in the slug's description.

**where:** `1.vision.experience.dimensions.md` axis B; `1.vision.yield.md` promise table row `privacy=full`.

**verdict:** —
