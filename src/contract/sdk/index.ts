import type { BrainAtom } from 'rhachet';

import { genBrainAtom } from '../../domain.operations/atom/genBrainAtom';
import { getAllAtomSlugs } from '../../domain.operations/atom/slug/getAllAtomSlugs';

/**
 * .what = returns all brain atoms provided by fireworks ai
 * .why = enables consumers to register fireworks ai atoms with genContextBrain
 *
 * 🔴 .note = a consumer selects a brain from this list by `atom.slug`, exact
 *         match. so a name absent here cannot be chosen, however well
 *         `genBrainAtom` accepts it. ⇒ EVERY name `genBrainAtom` accepts is
 *         listed, as its own atom, under its own name — pinned, versionless,
 *         legacy, and retired alike (`rule.require.redirected-slugs-selectable`).
 *
 * 🔴 .note = the list is DERIVED from the slug maps (`getAllAtomSlugs`), never
 *         kept by hand. a hand-kept list is how every legacy name went absent
 *         through v0.2.1: accepted by the union, forgotten by the list. derived,
 *         a name added to any map is selectable by construction.
 *
 * .note = a retirement with several replacements (AMBIGUOUS) is listed too. its
 *         choice resolves, and its ask fails with the named error that lists
 *         each replacement — never the bare "brain not found" of an absent one.
 */
export const getBrainAtomsByFireworksAI = (): BrainAtom[] =>
  getAllAtomSlugs().map((slug) => genBrainAtom({ slug }));

// re-export types for consumer use
//
// .note = every name is [...noun][qualifier] — `BrainAtomSlugFireworks`, not
//         `FireworksBrainAtomSlug` (`rule.require.order.noun_adj`). so one
//         `BrainAtomSlug` prefix in an autocomplete shows a consumer every
//         form this package accepts. the supplier-first order scatters them
//         instead, under a word every symbol here already shares.
export type {
  BrainAtomSlugFireworksPinned,
  BrainSuppliesFireworks,
  CredsFireworks,
} from '../../domain.operations/atom/BrainAtom.config';
// re-export factory for direct access
export { genBrainAtom } from '../../domain.operations/atom/genBrainAtom';
// the slug vocabulary, so a consumer can name any accepted form
export type { BrainAtomSlugFireworks } from '../../domain.operations/atom/slug/AtomSlug';
export type {
  BrainAtomSlugFireworksLatest,
  BrainAtomSlugFireworksLatestBare,
} from '../../domain.operations/atom/slug/AtomSlug.latest';
// the versionless registries, so a consumer can read what each generic names today
export {
  LATEST_BY_BARE_SLUG,
  PINNED_BY_LATEST_SLUG,
} from '../../domain.operations/atom/slug/AtomSlug.latest';
export type { BrainAtomSlugFireworksLegacy } from '../../domain.operations/atom/slug/AtomSlug.legacy';
// the legacy registry, so a consumer can find the canonical name of an old slug
export { PINNED_BY_LEGACY_SLUG } from '../../domain.operations/atom/slug/AtomSlug.legacy';
// the retirement registry, so a consumer can audit their own slugs
export type {
  AtomRetirementFireworks,
  BrainAtomSlugFireworksRetired,
} from '../../domain.operations/atom/slug/AtomSlug.retired';
export { RETIREMENT_BY_ATOM_SLUG } from '../../domain.operations/atom/slug/AtomSlug.retired';
// the cast itself, so a consumer can ask which model a name reaches
export { asPinnedAtomSlug } from '../../domain.operations/atom/slug/asPinnedAtomSlug';
