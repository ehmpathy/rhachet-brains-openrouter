# brain config pattern

## .what

one file declares the static model catalog; a cluster of slug maps names every other form.

| file | export | purpose |
|------|--------|---------|
| `atom/BrainAtom.config.ts` | `CONFIG_BY_ATOM_SLUG` | pinned slug → model id, description, spec |
| `atom/slug/AtomSlug.latest.ts` | `PINNED_BY_LATEST_SLUG`, `LATEST_BY_BARE_SLUG` | versionless names → pin |
| `atom/slug/AtomSlug.filtered.ts` | `SLUGS_FILTERED_LISTED` | filtered slugs listed in the registry |
| `atom/slug/AtomSlug.unlisted.ts` | `SPEC_ESTIMATE_UNLISTED` | the one placeholder spec every unlisted id shares |
| `atom/slug/AtomSlug.unlisted.ts` | `asUnlistedModelId`, `BrainAtomSlugOpenRouterUnlisted` | cast any other openrouter slug to its model id |

## .why

- **single source of truth** — each spec is declared once, on its pin
- **type safety** — each map is a `Record` over its own union, so a bad entry fails to compile
- **derived registry** — `getAllAtomSlugs()` reads the maps, so a name added to any map is
  selectable by construction (`rule.require.versionless-slugs-selectable`)
- **no hand-kept retirement** — openrouter dates each withdrawal as `expiration_date` on
  `/models`. that date is the record; the cached catalog read (`getAllCatalogModels`) carries it

## .withdrawal — read, never kept

| openrouter does | this package does |
|---|---|
| dates a model a tier names | the live catalog check goes red; re-aim the tier in `PINNED_BY_LATEST_SLUG` |
| withdraws a pin | the pin and its atom stay; an ask fails with `getOneWithdrawnModelError`, which offers live ids |
| withdraws an unlisted id | the same named error |

## .the pinned config

```ts
export type BrainAtomSlugOpenRouterPinned =
  | 'openrouter/deepseek/deepseek-v4-pro-0813'
  | 'openrouter/deepseek/deepseek-v4.1-flash'
  | 'openrouter/moonshotai/kimi-k3'
  | 'openrouter/z-ai/glm-5.3'
  | 'openrouter/z-ai/glm-5.3-flash';

export const CONFIG_BY_ATOM_SLUG: Record<BrainAtomSlugOpenRouterPinned, BrainAtomConfig> = {
  'openrouter/deepseek/deepseek-v4.1-flash': {
    model: 'deepseek/deepseek-v4.1-flash',          // openrouter's listed id: route + catalog reads
    weights: 'deepseek/deepseek-v4.1-flash-20260910', // its dated canonical_slug: sent on each ask
    description: 'deepseek-v4.1-flash - cheapfast vision (1M)',
    spec: new BrainSpec({ ... }),
  },
  // ...
};
```

## .slug conventions

| form | shape | example |
|---|---|---|
| pinned | `openrouter/{author}/{model}` — openrouter's id, verbatim | `openrouter/z-ai/glm-5.3` |
| latest | `openrouter/{author}/{tier}/latest` | `openrouter/deepseek/flash/latest` |
| bare | `openrouter/{author}/{tier}` | `openrouter/deepseek/flash` |
| unlisted | `openrouter/{author}/{model}` not in the config | `openrouter/acme/new-model` |
| + filters | any of the above, then `/{word}&{word}…` | `openrouter/deepseek/flash/floor&privacy=full` |

a static name always wins over the unlisted read. only a **bare** static slug can shadow an
openrouter id: an id is `{author}/{model}`, one slash. a pinned slug IS its id, so it shadows
naught; a `/latest` slug holds two slashes, so no id can equal it. the live catalog check
(`BrainAtom.config.integration` [case2]) fails the day openrouter lists an id that equals a bare
static slug.

## .the description carries the tier

each `description` names its tier word — `frontier` or `cheapfast`. the versionless map is read
off it, never judged (`rule.require.versionless-slug-per-tier`).

## .name conventions

| constant | content |
|----------|---------|
| `CONFIG_BY_ATOM_SLUG` | pin → config |
| `PINNED_BY_LATEST_SLUG` | `…/latest` → pin |
| `LATEST_BY_BARE_SLUG` | bare → `…/latest` |
| `BrainAtomSlugOpenRouter*` | the slug unions, noun first (`rule.require.order.noun_adj`) |
| `BrainAtomConfig` | shape of a config entry |
