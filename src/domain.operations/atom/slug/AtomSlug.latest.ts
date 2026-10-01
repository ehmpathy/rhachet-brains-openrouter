import type { BrainAtomSlugFireworksPinned } from '../BrainAtom.config';

/**
 * .what = versionless fireworks ai atom slugs
 * .why = lets a caller name a model FAMILY and TIER rather than a version, so
 *        a provider's version churn costs them no edit at all
 *
 * .shape = `fireworks/{family}/{tier}/latest` — the same shape a pinned slug
 *          takes, with `latest` in the version segment. so `flash/v4.1` and
 *          `flash/latest` are peers, and a caller moves between them by one
 *          word.
 *
 * .note = the tier segment is deliberate. a bare `fireworks/{family}/latest`
 *         would collapse the tiers into one name, so a caller who wanted a
 *         cheap model could wake up on a frontier one at 6x the rate. tier is
 *         the axis a caller chooses on; version is the axis they do not.
 *
 * .note = a family carries a generic only for a tier that has a LIVE model.
 *         kimi publishes no cheapfast model, so there is no
 *         `fireworks/kimi/flash/latest`.
 *
 * 🔴 .note = nor is there a `fireworks/kimi/code/latest`. kimi's code tier has
 *         exactly one model, `code/k2.7`, and it is retired with two candidate
 *         successors that fireworks did not choose between. a generic that
 *         pointed at it would be a scheduled break under a safe name, and a
 *         generic that picked a successor would guess for the caller. so the
 *         tier carries a pin and no generic, deliberately.
 */
export type BrainAtomSlugFireworksLatest =
  // deepseek
  | 'fireworks/deepseek/pro/latest'
  | 'fireworks/deepseek/flash/latest'
  // moonshot/kimi
  | 'fireworks/kimi/pro/latest'
  // z.ai/glm
  | 'fireworks/glm/pro/latest'
  | 'fireworks/glm/flash/latest'
  // minimax
  | 'fireworks/minimax/flash/latest'
  // fireworks/gpt-oss
  | 'fireworks/gpt-oss/flash/latest'
  // nvidia/nemotron
  | 'fireworks/nemotron/flash/latest';

/**
 * .what = the pinned slug each versionless generic names today
 * .why = one edit here re-aims every consumer on that generic, so a provider's
 *        version churn never reaches them
 *
 * .note = tier is read from each model's own `description` — `frontier` maps
 *         to `pro`, `cheapfast`/`cheapest` map to `flash`. so the assignment
 *         is read off the catalog rather than invented.
 *
 * ⚠️ .note = `deepseek/pro/latest` is a CROSS-TIER exception. fireworks named
 *         `v4.1-flash` as the successor to the retired `v4-pro`, and deepseek
 *         publishes no un-retired pro-tier model, so this generic points at a
 *         CHEAPFAST model: `$1.32` -> `$0.22` input, swe-bench 80.6% ->
 *         unpublished. a caller here gets a weaker, cheaper model than the
 *         name suggests, and both deepseek generics name the same model while
 *         that stands.
 *
 *         it is NOT the same call as the pinned `deepseek/pro/v4`, which still
 *         refuses to re-aim. a caller who named the exact model chose that
 *         capacity; a caller on the generic delegated the choice to us.
 *         delegation is the whole difference.
 *
 *         ⇒ when deepseek ships a real pro-tier model, this one line re-aims
 *           every caller on the generic and the tier drop is undone.
 */
export const PINNED_BY_LATEST_SLUG: Record<
  BrainAtomSlugFireworksLatest,
  BrainAtomSlugFireworksPinned
> = {
  // deepseek — ⚠️ pro is a CROSS-TIER exception; see the note above
  'fireworks/deepseek/pro/latest': 'fireworks/deepseek/flash/v4.1',
  'fireworks/deepseek/flash/latest': 'fireworks/deepseek/flash/v4.1',
  // moonshot/kimi — 'frontier vision' -> pro
  'fireworks/kimi/pro/latest': 'fireworks/kimi/pro/k3',
  // z.ai/glm — 'frontier code' -> pro, 'cheapfast vision' -> flash
  'fireworks/glm/pro/latest': 'fireworks/glm/pro/5.3',
  'fireworks/glm/flash/latest': 'fireworks/glm/flash/5.3',
  // minimax — 'cheapfast multimodal' -> flash
  'fireworks/minimax/flash/latest': 'fireworks/minimax/flash/m3',
  // fireworks/gpt-oss — 'cheapfast' -> flash
  'fireworks/gpt-oss/flash/latest': 'fireworks/gpt-oss/flash/120b',
  // nvidia/nemotron — 'cheapest' -> flash
  'fireworks/nemotron/flash/latest': 'fireworks/nemotron/flash/3.5',
};

/**
 * .what = tells a versionless generic slug from a pinned one
 * .why = this map is read only for names whose version segment is `latest`,
 *        and a type guard narrows without an as-cast (`rule.forbid.as-cast`)
 */
export const isLatestAtomSlug = (
  slug: string,
): slug is BrainAtomSlugFireworksLatest => slug in PINNED_BY_LATEST_SLUG;

/**
 * .what = drops the `/latest` segment from a versionless slug
 * .why = derives the bare union FROM the latest union, so the two cannot drift
 */
type AsLatestBareSlug<TSlug> = TSlug extends `${infer TBare}/latest`
  ? TBare
  : never;

/**
 * .what = bare versionless slugs — `fireworks/{family}/{tier}`
 * .why = the shortest name a caller can hold: family and tier, the two axes
 *        they chose on, and no version at all. it means exactly what
 *        `fireworks/{family}/{tier}/latest` means.
 *
 * .note = one bare slug per `/latest` slug, by construction. a tier with no
 *         generic (kimi/code, kimi/flash) has no bare slug either.
 */
export type BrainAtomSlugFireworksLatestBare =
  AsLatestBareSlug<BrainAtomSlugFireworksLatest>;

/**
 * .what = the `/latest` slug each bare slug means
 * .why = a bare slug is an alias of an alias; it resolves through the latest
 *        registry, so a re-aim there re-aims both names at once
 *
 * .note = `Record` forces one row per bare slug, and
 *         `asPinnedAtomSlug.test.ts` asserts each row is `${bare}/latest`.
 */
export const LATEST_BY_BARE_SLUG: Record<
  BrainAtomSlugFireworksLatestBare,
  BrainAtomSlugFireworksLatest
> = {
  // deepseek
  'fireworks/deepseek/pro': 'fireworks/deepseek/pro/latest',
  'fireworks/deepseek/flash': 'fireworks/deepseek/flash/latest',
  // moonshot/kimi
  'fireworks/kimi/pro': 'fireworks/kimi/pro/latest',
  // z.ai/glm
  'fireworks/glm/pro': 'fireworks/glm/pro/latest',
  'fireworks/glm/flash': 'fireworks/glm/flash/latest',
  // minimax
  'fireworks/minimax/flash': 'fireworks/minimax/flash/latest',
  // fireworks/gpt-oss
  'fireworks/gpt-oss/flash': 'fireworks/gpt-oss/flash/latest',
  // nvidia/nemotron
  'fireworks/nemotron/flash': 'fireworks/nemotron/flash/latest',
};

/**
 * .what = tells a bare versionless slug from every other form
 * .why = a type guard narrows without an as-cast (`rule.forbid.as-cast`)
 */
export const isLatestBareAtomSlug = (
  slug: string,
): slug is BrainAtomSlugFireworksLatestBare => slug in LATEST_BY_BARE_SLUG;
