# rule.require.pin-explicit-model-ids

## .what

pin every model id to the **most explicit form the provider offers** — the dated/versioned
id, never a floating alias.

```
👎 accounts/fireworks/models/deepseek-v4-pro          # floating alias
👍 accounts/fireworks/models/deepseek-v4-pro-0813     # explicit pin
```

when both an alias and a dated id serve, the config takes the **dated** one.

## .why

a floating alias is a promise the provider can move or withdraw without a diff in our repo.
two distinct hazards ride on it:

- **silent weight drift** — the alias re-points to new weights; prompts and evals shift
  under us with no signal. the run that passed yesterday is not the run we get today.
- **alias rot** — the alias is withdrawn while dated ids keep serving, so calls 404 on an
  id that a catalog page may still advertise.

both are triggered by the provider's clock, not ours. an explicit pin converts an
unannounced behavior change into a stable, legible fact.

## .the evidence

`fireworks/deepseek/v4-flash` pointed at `deepseek-v4-flash`. that id began to return
`404 NOT_FOUND` while `deepseek-v4-flash-0731` served normally. `DEFAULT_BRAIN` and
`FIXED_FALLBACK_BRAIN` in `rhachet-roles-bhrain` both name that slug, so every peer
reviewer in every repo without an explicit `--brain` failed at once — observed as 9/9
level-1 reviewers that malfunctioned identically.

a catalog read of the fireworks account on 2026-08-14 showed the hazard elsewhere in this
config: both `deepseek-v4-pro` and `deepseek-v4-pro-0813` appear. we took the alias.

🔴 **this paragraph once read "both are served… live and latent." that was wrong, and the
error is instructive.** a live probe on 2026-09-16 found `deepseek-v4-pro` answered **404**
on inference while it sat in the catalog. the hazard was never latent — it had already
fired, and the catalog read could not see it. a catalog says what fireworks *knows*, never
what it *runs*. ⇒ `rule.always.verify-model-ids-by-live-call`.

## .how

1. **read the catalog before you add or change a model id** — do not copy an id from a
   vendor page or a blog post:
   ```
   GET https://api.fireworks.ai/inference/v1/models?page_size=200
   Authorization: Bearer $FIREWORKS_API_KEY
   ```
   ⚠️ **this step finds CANDIDATES, and proves naught.** an id in this response may still
   404 on inference — measured, three times, on 2026-09-16. the catalog read is necessary
   and not sufficient; only a live completion settles serve-ability
   (`rule.always.verify-model-ids-by-live-call`).
2. **prefer the dated id** when an alias and a dated id both appear for the same model —
   then probe **both** live, since the dated one can be dead too.
3. **record the check** — note the id and the date verified in the config comment, so a
   later reader knows the pin was observed, not assumed.
4. **keep the slug stable** — our `fireworks/<family>/<model>` slug is our contract with
   consumers. a re-pin must never change the slug.

## .the caveat — a pin is necessary, not sufficient

pinning closes drift and alias rot. it does **not** close deprecation.

fireworks may "deprecate models from serverless with at least 2 weeks notice"
(docs.fireworks.ai/models/overview). that notice arrives out-of-band — no repo diff, no
build failure — and it removes dated ids too.

observed here: `glm-5p1` 404s not because of a rename but because pay-per-token for
GLM-5.1 was deprecated effective **2026-08-07**; the model remains on provisioned
throughput only. **no pin would have prevented that.** and the fix differs in kind — a
deprecated model must be dropped or moved to provisioned throughput, never "re-pinned".

so a pin must be paired with a **live liveness check** that asserts every configured id is
still served. no file in our repo changes when a provider retires a model, so there is no
diff for a PR gate to trigger on. the check is mechanized as
`BrainAtom.config.integration.test.ts`.

## .diagnosis aid

| symptom | likely cause | fix |
|---|---|---|
| id 404s, a dated peer serves | alias rot | pin to the dated id |
| id 404s, no peer serves | deprecated/withdrawn | drop it, or move to provisioned throughput |
| id serves but output shifted | weight drift under an alias | pin to the dated id |

🟡 note the middle row's test is **"no peer serves"**, never "no peer in the catalog" — a
peer can sit in the catalog and 404 all the same.

## .enforcement

- a model id that uses a floating alias where a dated id is served = **blocker**
- a model id added without a catalog read AND a live call = **blocker**
- a configured id that 404s on inference = **blocker**
- a deprecated model "fixed" by a re-pin rather than removal = **blocker**

## .see also

- `rule.always.verify-model-ids-by-live-call` — the serve-ability half; corrects this rule's
  catalog-read step
- `rule.require.versionless-slug-per-tier` — 🟡 the necessary PEER. this rule makes our
  **internal** model id explicit; that one keeps our **public** slug versionless, so a pin
  we must re-aim costs a consumer no edit. a package that pins internally and exports the
  version outward has merely moved the churn downstream.
- `define.brain-config-pattern` — where model ids are declared
- `rule.require.pinned-versions` (mechanic) — the same argument for package deps
- `rule.require.errors-name-the-fix` (ergonomist) — a retired id should surface as a named
  cause, not a bare `NotFoundError`

## .sources

- [Fireworks — Models overview (deprecation notice period)](https://docs.fireworks.ai/models/overview)
- [Fireworks — GLM 5.1 model page](https://fireworks.ai/models/fireworks/glm-5p1)
- [Fireworks models on Microsoft Foundry (GLM-5.1 / MiniMax-M2.5 pay-per-token deprecation, 2026-08-07)](https://learn.microsoft.com/en-us/azure/foundry/how-to/fireworks/enable-fireworks-models)
