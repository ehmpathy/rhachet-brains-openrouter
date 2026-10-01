import type { BrainAtomSlugFireworksPinned } from '../BrainAtom.config';

/**
 * .what = slug names this package published before the tier segment existed
 * .why = they are a CONTRACT we already shipped, so they keep their meaning
 *        forever
 *
 * .note = the canonical shape is `fireworks/{family}/{tier}/{version}`. these
 *         predate it and carry the tier mashed into the version
 *         (`v4.1-flash`, `5.3-flash`) or omit it entirely (`k3`, `120b`).
 *
 * 🔴 .note = a rename is CHURN unless the old name survives. to drop these
 *         would break every consumer the versionless scheme exists to protect,
 *         and would do it in the same change that promised not to.
 */
export type BrainAtomSlugFireworksLegacy =
  // deepseek
  | 'fireworks/deepseek/v4-pro'
  | 'fireworks/deepseek/v4.1-flash'
  | 'fireworks/deepseek/v4-flash'
  // moonshot/kimi
  | 'fireworks/kimi/k3'
  | 'fireworks/kimi/k2.7-code'
  | 'fireworks/kimi/k2.6'
  // z.ai/glm
  | 'fireworks/glm/5.3'
  | 'fireworks/glm/5.3-flash'
  | 'fireworks/glm/5.2'
  // minimax
  | 'fireworks/minimax/m3'
  // fireworks/gpt-oss
  | 'fireworks/gpt-oss/120b'
  // nvidia/nemotron
  | 'fireworks/nemotron/3.5-lightning';

/**
 * .what = the canonical slug each legacy name now points at
 * .why = a consumer on an old name reaches the same model, with no edit
 *
 * .note = a pure RENAME — every row names the identical model it always did.
 *         no row here changes which weights a caller reaches. where a model
 *         also retired, that is a separate fact, held by the retirement
 *         registry, which `asPinnedAtomSlug` walks after this lookup.
 *
 * .note = the glm pair is what the tier segment buys. `5.3` and `5.3-flash`
 *         were told apart by a suffix; `pro/5.3` and `flash/5.3` are told
 *         apart by the axis that actually differs.
 */
export const PINNED_BY_LEGACY_SLUG: Record<
  BrainAtomSlugFireworksLegacy,
  BrainAtomSlugFireworksPinned
> = {
  // deepseek
  'fireworks/deepseek/v4-pro': 'fireworks/deepseek/pro/v4',
  'fireworks/deepseek/v4.1-flash': 'fireworks/deepseek/flash/v4.1',
  'fireworks/deepseek/v4-flash': 'fireworks/deepseek/flash/v4',
  // moonshot/kimi
  'fireworks/kimi/k3': 'fireworks/kimi/pro/k3',
  'fireworks/kimi/k2.7-code': 'fireworks/kimi/code/k2.7',
  'fireworks/kimi/k2.6': 'fireworks/kimi/pro/k2.6',
  // z.ai/glm
  'fireworks/glm/5.3': 'fireworks/glm/pro/5.3',
  'fireworks/glm/5.3-flash': 'fireworks/glm/flash/5.3',
  'fireworks/glm/5.2': 'fireworks/glm/pro/5.2',
  // minimax
  'fireworks/minimax/m3': 'fireworks/minimax/flash/m3',
  // fireworks/gpt-oss
  'fireworks/gpt-oss/120b': 'fireworks/gpt-oss/flash/120b',
  // nvidia/nemotron
  'fireworks/nemotron/3.5-lightning': 'fireworks/nemotron/flash/3.5',
};

/**
 * .what = tells a legacy slug from a canonical one
 * .why = this map is read only for names that predate the tier segment, and a
 *        type guard narrows without an as-cast (`rule.forbid.as-cast`)
 */
export const isLegacyAtomSlug = (
  slug: string,
): slug is BrainAtomSlugFireworksLegacy => slug in PINNED_BY_LEGACY_SLUG;
