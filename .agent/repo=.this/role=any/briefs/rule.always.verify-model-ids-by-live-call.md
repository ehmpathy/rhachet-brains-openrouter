# rule.always.verify-model-ids-by-live-call

## .what

whenever you touch this repo's static catalog — add an id, re-pin an id, re-aim a generic,
refresh rates, or merely pass through `BrainAtom.config.ts` — **prove every configured id with a
live chat completion.** run it, read the verdict, record the date.

```
👎  GET /models lists it            → NOT evidence
👍  POST /chat/completions answers  → evidence
```

the check is mechanized:

```sh
rhx keyrack unlock --owner ehmpath --env test
rhx git.repo.test --what integration --scope BrainAtom.config --mode apply
```

`BrainAtom.config.integration.test.ts` probes **every** id in `CONFIG_BY_ATOM_SLUG` with a
one-token completion and fails on the first that does not answer.

## .why — a catalog LISTS; it does not SERVE

a model catalog answers *"does the provider know this name?"*, never *"will it run it?"*.

**measured 2026-09-16, on this package's predecessor provider.** its models api listed three ids
as available. all three answered `404 Model not found` on inference. one of them had been cited,
by an earlier version of this very rule, as "listed and latent". it was already dead.

openrouter adds a second gap: an id serves only while **some endpoint** hosts it. the endpoint
list can empty while the catalog still lists the id.

## .why — the rot is silent

no file in this repo changes when a provider withdraws a model:

- no diff, so no PR gate fires
- no type error, so no build fails
- the unit suite stays green; it never leaves the process
- ⇒ **the catalog can rot for a month and report healthy the whole time**

## .when it fires

| when… | then… |
|---|---|
| you **add** a model id | probe it live before the id lands |
| you **re-pin** an id to a dated peer | probe **both** — the dated one may be dead too |
| you **re-aim** a versionless generic | probe the new target |
| you **refresh rates** or context windows | probe the whole catalog; the visit is the cheap moment |
| you touch `BrainAtom.config.ts` **at all** | run the probe. it is one command |
| you read an id from a blog, a model page, or `/models` | 🔴 that is a **candidate**, never a verified id |
| the probe fails | diagnose it — see below — never re-pin blindly |
| you would trust a green unit suite | 🔴 the unit suite cannot see the provider |

## .the diagnosis — a failure has three causes and three fixes

| symptom | cause | fix |
|---|---|---|
| id 404s, a dated peer serves | alias rot | re-pin to the dated id; keep the slug |
| id 404s, no peer serves | withdrawn — the catalog dates or drops it | re-aim every tier that names it; the pin stays and fails named. a re-pin cannot fix a withdrawal |
| id serves, output shifted | weight drift under an alias | re-pin to the dated id |

## .what to record

- the **date** its live call was verified, in the config comment
- the **context window** exactly as the catalog reports `context_length` (`1_048_576`, not "1M")

## .the bound

this rule governs **serve-ability** of the **static** catalog. an unlisted id is checked against
the live catalog at ask time and needs no probe here. `rule.require.pin-explicit-model-ids`
governs **which form** of an id to take.

## .enforcement

- a model id added or re-pinned with no live call on record = **blocker**
- a catalog read cited as proof an id serves = **blocker**
- a touch of `BrainAtom.config.ts` that ships without the live probe = **blocker**
- a withdrawn model "fixed" by a re-pin rather than a tier re-aim = **blocker**
- a context window rounded where the catalog reports an exact figure = **nitpick**

## .see also

- `rule.require.pin-explicit-model-ids` — the which-form rule this completes
- `define.brain-config-pattern` — where model ids are declared
- `BrainAtom.config.integration.test.ts` — the mechanized probe
