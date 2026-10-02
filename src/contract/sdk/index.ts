import type { BrainAtom } from 'rhachet';

import { genBrainAtom } from '../../domain.operations/atom/genBrainAtom';
import { SLUGS_FILTERED_LISTED } from '../../domain.operations/atom/slug/AtomSlug.filtered';
import { getAllAtomSlugs } from '../../domain.operations/atom/slug/getAllAtomSlugs';

/**
 * .what = returns all brain atoms provided by openrouter
 * .why = enables consumers to register openrouter atoms with genContextBrain
 *
 * 🔴 .note = a consumer selects a brain from this list by `atom.slug`, exact
 *         match. so a name absent here cannot be chosen, however well
 *         `genBrainAtom` accepts it. ⇒ every listed name is its own atom, under
 *         its own name (`rule.require.versionless-slugs-selectable`).
 *
 * 🔴 .note = only two forms are listed: the bare tier names, and the filtered
 *         slugs we use ourselves. a model id is never listed, nor kept in this
 *         package — a tier reads its newest model from openrouter's catalog at
 *         ask, so no name here can rot under a consumer, and no version bump
 *         needs a release. `genBrainAtom` still accepts any openrouter id, unlisted.
 *
 * .note = the list is DERIVED from the slug maps (`getAllAtomSlugs`), never
 *         kept by hand, so a name added to a map is selectable by construction.
 */
export const getBrainAtomsByOpenRouter = (): BrainAtom[] => [
  ...getAllAtomSlugs().map((slug) => genBrainAtom({ slug })),
  ...SLUGS_FILTERED_LISTED.map((slug) => genBrainAtom({ slug })),
];

// the supply report each ask attaches as `output.supply`
export type { SupplyReport } from '../../domain.objects/SupplyReport';
// re-export types for consumer use
//
// .note = every name is [...noun][qualifier] — `BrainAtomSlugOpenRouter`, not
//         `OpenRouterBrainAtomSlug` (`rule.require.order.noun_adj`). so one
//         `BrainAtomSlug` prefix in an autocomplete shows a consumer every
//         form this package accepts. the supplier-first order scatters them
//         instead, under a word every symbol here already shares.
export type {
  BrainSuppliesOpenRouter,
  CredsOpenRouter,
} from '../../domain.operations/atom/BrainAtom.config';
// re-export factory for direct access
export { genBrainAtom } from '../../domain.operations/atom/genBrainAtom';
// the slug vocabulary, so a consumer can name any accepted form
export type {
  BrainAtomSlugOpenRouter,
  BrainAtomSlugOpenRouterFiltered,
} from '../../domain.operations/atom/slug/AtomSlug';
export type { BrainAtomSlugOpenRouterBare } from '../../domain.operations/atom/slug/AtomSlug.bare';
// the unlisted form, so a consumer can name any openrouter id with no release
export type { BrainAtomSlugOpenRouterUnlisted } from '../../domain.operations/atom/slug/AtomSlug.unlisted';
