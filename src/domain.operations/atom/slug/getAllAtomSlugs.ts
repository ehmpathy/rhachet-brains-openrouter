import type { BrainAtomSlugOpenRouter } from './AtomSlug';
import { TIER_BY_BARE_SLUG } from './AtomSlug.bare';

/**
 * .what = every listed slug name `genBrainAtom` accepts, as a runtime list
 * .why = the runtime twin of `BrainAtomSlugOpenRouter`. the registry is built
 *        FROM this list, so a name added to the map is selectable by
 *        construction — never by a second, hand-kept list that can forget it
 *        (`rule.require.versionless-slugs-selectable`)
 */
export const getAllAtomSlugs = (): BrainAtomSlugOpenRouter[] =>
  Object.keys(TIER_BY_BARE_SLUG) as BrainAtomSlugOpenRouter[]; // .note = Object.keys widens a Record's keys to string; the map is keyed by the union
