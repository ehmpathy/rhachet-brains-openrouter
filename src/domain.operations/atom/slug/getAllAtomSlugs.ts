import { CONFIG_BY_ATOM_SLUG } from '../BrainAtom.config';
import type { BrainAtomSlugFireworks } from './AtomSlug';
import { LATEST_BY_BARE_SLUG, PINNED_BY_LATEST_SLUG } from './AtomSlug.latest';
import { PINNED_BY_LEGACY_SLUG } from './AtomSlug.legacy';

/**
 * .what = every slug name `genBrainAtom` accepts, as a runtime list
 * .why = the runtime twin of `BrainAtomSlugFireworks`. the registry is built
 *        FROM this list, so a name added to any map is selectable by
 *        construction — never by a second, hand-kept list that can forget it
 *        (`rule.require.redirected-slugs-selectable`)
 *
 * .note = each map is a `Record` keyed by its union, so its keys ARE that
 *         union. four maps, four unions — the same four `AtomSlug.ts` composes.
 */
export const getAllAtomSlugs = (): BrainAtomSlugFireworks[] => [
  ...(Object.keys(CONFIG_BY_ATOM_SLUG) as BrainAtomSlugFireworks[]), // .note = Object.keys widens a Record's keys to string; each map is keyed by a member of the union
  ...(Object.keys(PINNED_BY_LATEST_SLUG) as BrainAtomSlugFireworks[]),
  ...(Object.keys(LATEST_BY_BARE_SLUG) as BrainAtomSlugFireworks[]),
  ...(Object.keys(PINNED_BY_LEGACY_SLUG) as BrainAtomSlugFireworks[]),
];
