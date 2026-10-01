# rule.always.verify-model-ids-by-live-call

## .what

whenever you touch this repo's model catalog — add an id, re-pin an id, refresh the rates,
or merely pass through `BrainAtom.config.ts` — **prove every configured id with a live chat
completion.** run it, read the verdict, record the date.

```
👎  GET /models returns it          → NOT evidence
👍  POST /chat/completions answers  → evidence
```

the check is already mechanized. run it:

```sh
rhx keyrack unlock --owner ehmpath --env test
rhx git.repo.test --what integration --scope BrainAtom.config --mode apply
```

`BrainAtom.config.integration.test.ts` probes **every** id in `CONFIG_BY_ATOM_SLUG` with a
one-token completion and fails the suite on the first that 404s.

## .why — the catalog LISTS; it does not SERVE

`rule.require.pin-explicit-model-ids` prescribes a catalog read and calls the api
"authoritative over any catalog or docs page." that is true against a **vendor page**, and
**insufficient against the api itself**.

**measured 2026-09-16.** the models api returned all three of these as available. all three
answered `404 Model not found, inaccessible, and/or not deployed` on inference:

| id | in `/models` | serves |
|---|---|---|
| `deepseek-v4-pro` | ✔ listed | ✘ **404** |
| `qwen3p7-plus` | ✔ listed | ✘ **404** |
| `minimax-m2p7` | ✔ listed | ✘ **404** |

🔴 **the first row is the sharpest.** the prior rule read the catalog, saw `deepseek-v4-pro`
and `deepseek-v4-pro-0813` both present, and concluded the alias was "served" — it named
this exact pair as "live and latent." **it was not latent. it was already dead**, and the
catalog said otherwise.

⇒ so `/models` answers *"does fireworks know this name?"*, never *"will fireworks run it?"*.
those are different questions, and only the second one is the one we have.

## .why — the rot is silent, and silence is the whole cost

no file in this repo changes when a provider retires a model. so:

- no diff, so no PR gate fires
- no type error, so no build fails
- the unit suite stays green, because it never leaves the process
- ⇒ **the catalog can rot for a month and report healthy the whole time**

**measured:** main's CI last ran a live pass on 2026-08-15. by 2026-09-16 the catalog
carried **three dead ids** and one wrong context window (`kimi-k2.6` declared 128K against
an actual 262,144 — wrong by half, which silently halves a caller's budget). every one of
those was found by the first live call anyone made in a month.

## .when it fires

| when… | then… |
|---|---|
| you **add** a model id | probe it live before the id lands |
| you **re-pin** an id to a dated peer | probe **both** — the dated one may be dead too |
| you **refresh rates** or context windows | probe the whole catalog; the visit is the cheap moment |
| you touch `BrainAtom.config.ts` **at all** | run the probe. it is one command |
| you read an id from a blog, a model page, or `/models` | 🔴 that is a **candidate**, never a verified id |
| the probe reports a 404 | diagnose it — see the table below — never re-pin blindly |
| you would trust a green unit suite | 🔴 the unit suite cannot see the provider |

## .the diagnosis — a 404 has three causes and three different fixes

| symptom | cause | fix |
|---|---|---|
| id 404s, a **dated peer serves** | alias rot | re-pin to the dated id; keep the slug |
| id 404s, **no peer serves** | deprecated / withdrawn | **drop the slug.** a re-pin cannot fix a deprecation |
| id serves, **output shifted** | weight drift under an alias | re-pin to the dated id |

⚠️ the middle row breaks this package's slug union. that is correct and unavoidable — a slug
that names a dead model is worse than an absent one, because a caller finds out in
production rather than at compile time.

## .what to record

a probe you do not write down is a probe the next reader must re-run. every id carries:

- the **date** its live call was verified, in the config comment
- the **context window** as the models api reports it — exact, never a rounded vendor figure
  (`1_048_576`, not "1M")
- for a dropped slug, a `.note` on the union that names the id and the evidence

## .the bound

this rule governs **serve-ability**, which only a live call settles. it does not replace
`rule.require.pin-explicit-model-ids` — that one governs **which form** of an id to take,
and it still holds in full. take the dated id, *and* prove it answers.

## .enforcement

- a model id added or re-pinned with no live call on record = **blocker**
- a catalog read (`/models`, a model page, a blog) cited as proof an id serves = **blocker**
- a touch of `BrainAtom.config.ts` that ships without a live catalog probe = **blocker**
- a deprecated model "fixed" by a re-pin rather than a drop = **blocker**
- a context window taken from a vendor page where the api reports an exact figure = **nitpick**

## .see also

- `rule.require.pin-explicit-model-ids` — the WHICH-FORM rule this completes.
  🔴 its `.how` step 1 and its "live and latent" evidence paragraph are **corrected here**:
  a catalog read is necessary and not sufficient, and the `deepseek-v4-pro` alias it cited
  as served was already dead.
- `define.brain-config-pattern` — where model ids are declared
- `BrainAtom.config.integration.test.ts` — the mechanized probe

## .sources

- live probe of every catalog id, 2026-09-16 (this repo)
- [Fireworks — Models overview (deprecation notice period)](https://docs.fireworks.ai/models/overview)
- [Fireworks — serverless rates](https://docs.fireworks.ai/serverless/rates)
