import type { BrainAtomSlugOpenRouterFiltered } from './AtomSlug';

/**
 * .what = filtered slugs listed as atoms, so a consumer can choose them by name
 * .why = rhachet selects a brain by exact `atom.slug`; until it routes the
 *        declared patterns (reseed: rhachet-wildcard-brain-dispatch), a
 *        filtered slug is selectable only if listed here
 *
 * .note = each entry is a composite we use ourselves. `genBrainAtom` accepts
 *         any filter segment; this list only grows what a `choice` can name.
 */
export const SLUGS_FILTERED_LISTED: BrainAtomSlugOpenRouterFiltered[] = [
  // the reviewer fleet's floor: cheapest zdr endpoint at >= 50 tok/s (wisher, 2026-10-01)
  'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full',
];
