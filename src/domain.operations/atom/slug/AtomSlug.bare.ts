import type { BrainSpec } from 'rhachet/brains';

import { SPEC_ESTIMATE_BY_TIER } from '../BrainAtom.config';

/**
 * .what = the listed openrouter atom slugs — `openrouter/{author}/{tier}`
 * .why = a caller names an author and a TIER, never a model id, so a provider's
 *        version churn costs them no edit. each name always reaches the newest
 *        model of its tier, so it never needs to retire
 *
 * .note = the tier segment is deliberate. a bare `openrouter/{author}` would
 *         collapse the tiers into one name, so a caller who wanted a cheap model
 *         could wake up on a frontier one. tier is the axis a caller chooses on;
 *         version is the axis they do not.
 *
 * .note = an author carries a name only for a tier it publishes. kimi has no
 *         cheapfast line, so there is no `openrouter/moonshotai/flash`.
 */
export type BrainAtomSlugOpenRouterBare =
  // deepseek
  | 'openrouter/deepseek/pro'
  | 'openrouter/deepseek/flash'
  // moonshot/kimi
  | 'openrouter/moonshotai/pro'
  // z.ai/glm
  | 'openrouter/z-ai/pro'
  | 'openrouter/z-ai/flash';

/**
 * .what = how one tier finds its model in openrouter's catalog
 * .why = a tier names a model LINE, never a version. the newest catalog id that
 *        matches the line, and that openrouter has not dated for withdrawal,
 *        is the model the tier reaches (`getOneTierModel`)
 */
export type AtomTier = {
  line: RegExp; // the openrouter ids of this tier's model line, any version
  description: string;
  spec: BrainSpec; // an ESTIMATE: the model is read at ask, after build
};

/**
 * .what = the version segment of a model line, any version
 * .why = `v4`, `4.1`, `5.3` all match; a dated suffix like `-0813` is allowed,
 *        since openrouter lists some dated ids as their own rows
 */
const VERSION = String.raw`\d+(?:\.\d+)*`;
const DATED = String.raw`(?:-\d{4})?`;

/**
 * .what = the tier each bare slug names
 * .why = no model id lives here, so a provider's version bump needs no edit.
 *        only a renamed model LINE does, which is rare
 *
 * .note = each line is strict: a preview, an experiment, a reason-mode variant,
 *         a `:free` row, and every other variant never match, so a tier reaches
 *         only the plain model
 * .note = the tier word follows each vendor's own scheme: `pro` and `flash` for
 *         deepseek, a bare `kimi-k{n}` for kimi, a bare `glm-{n}` and `-flash`
 *         for glm
 */
export const TIER_BY_BARE_SLUG: Record<BrainAtomSlugOpenRouterBare, AtomTier> =
  {
    'openrouter/deepseek/pro': {
      line: new RegExp(`^deepseek/deepseek-v${VERSION}-pro${DATED}$`),
      description: 'deepseek pro - frontier',
      spec: SPEC_ESTIMATE_BY_TIER.pro,
    },
    'openrouter/deepseek/flash': {
      line: new RegExp(`^deepseek/deepseek-v${VERSION}-flash${DATED}$`),
      description: 'deepseek flash - cheapfast',
      spec: SPEC_ESTIMATE_BY_TIER.flash,
    },
    'openrouter/moonshotai/pro': {
      line: new RegExp(`^moonshotai/kimi-k${VERSION}${DATED}$`),
      description: 'kimi pro - frontier',
      spec: SPEC_ESTIMATE_BY_TIER.pro,
    },
    'openrouter/z-ai/pro': {
      line: new RegExp(`^z-ai/glm-${VERSION}${DATED}$`),
      description: 'glm pro - frontier',
      spec: SPEC_ESTIMATE_BY_TIER.pro,
    },
    'openrouter/z-ai/flash': {
      line: new RegExp(`^z-ai/glm-${VERSION}-flash${DATED}$`),
      description: 'glm flash - cheapfast',
      spec: SPEC_ESTIMATE_BY_TIER.flash,
    },
  };
