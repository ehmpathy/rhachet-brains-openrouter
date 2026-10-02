import type { BrainAtomSlugOpenRouterBare } from './AtomSlug.bare';

/**
 * .what = every listed slug name `genBrainAtom` accepts
 * .why = a caller names a tier, never a version: `openrouter/{author}/{tier}`
 *
 * ⇒ `getOneTierModel` reads the newest model of its line from openrouter's
 *   catalog, at ask, and holds it 7 days on this machine.
 *
 * .note = a model id is never a listed name. any openrouter id still serves as
 *         an unlisted slug (`BrainAtomSlugOpenRouterUnlisted`), with no promise
 *         that it outlives openrouter's own catalog
 * .note = this union only ever GROWS. a bare name accepted in any prior release
 *         is accepted still, which is the whole promise of the package.
 */
export type BrainAtomSlugOpenRouter = BrainAtomSlugOpenRouterBare;

/**
 * .what = a listed slug, plus a supply filter segment
 * .why = the caller says which hosts may supply the ask, in the slug itself
 *
 * .example = 'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full'
 */
export type BrainAtomSlugOpenRouterFiltered =
  `${BrainAtomSlugOpenRouter}/${string}`;
