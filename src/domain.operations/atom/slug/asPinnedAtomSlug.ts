import { UnexpectedCodePathError } from 'helpful-errors';

import type { BrainAtomSlugFireworksPinned } from '../BrainAtom.config';
import type { BrainAtomSlugFireworks } from './AtomSlug';
import {
  isLatestAtomSlug,
  isLatestBareAtomSlug,
  LATEST_BY_BARE_SLUG,
  PINNED_BY_LATEST_SLUG,
} from './AtomSlug.latest';
import { isLegacyAtomSlug, PINNED_BY_LEGACY_SLUG } from './AtomSlug.legacy';
import { isRetiredAtomSlug, RETIREMENT_BY_ATOM_SLUG } from './AtomSlug.retired';

/**
 * .what = casts a legacy or versionless name onto the canonical slug it means
 * .why = both are ALIASES — a second name for a model already in the catalog —
 *        so they are read from a map before any retirement is considered
 *
 * .note = a canonical slug falls through untouched. that is the common case.
 */
const asCanonicalAtomSlug = (input: {
  slug: BrainAtomSlugFireworks;
}): BrainAtomSlugFireworksPinned => {
  if (isLegacyAtomSlug(input.slug)) return PINNED_BY_LEGACY_SLUG[input.slug];
  if (isLatestAtomSlug(input.slug)) return PINNED_BY_LATEST_SLUG[input.slug];
  if (isLatestBareAtomSlug(input.slug))
    return PINNED_BY_LATEST_SLUG[LATEST_BY_BARE_SLUG[input.slug]];
  return input.slug;
};

/**
 * .what = follows retirement routes until one lands on a slug that stands
 * .why = a successor may itself retire later, so one hop is not enough
 *
 * .note = the `seen` list is the whole termination argument. the registry is
 *         finite, so a walk that never repeats a slug must halt; a walk that
 *         repeats one has a cycle, and that is a registry defect worth a name.
 */
const walkOneRetirementRoute = (input: {
  slug: BrainAtomSlugFireworksPinned;
  seen: BrainAtomSlugFireworksPinned[];
}): BrainAtomSlugFireworksPinned => {
  // a slug with no retirement is the end of the walk
  if (!isRetiredAtomSlug(input.slug)) return input.slug;

  // an ambiguous retirement has no blessed successor, so the slug stands
  const retirement = RETIREMENT_BY_ATOM_SLUG[input.slug];
  if (retirement.kind === 'AMBIGUOUS') return input.slug;

  // a cycle would spin forever, so report it rather than hang
  if (input.seen.includes(retirement.into))
    throw new UnexpectedCodePathError(
      'retirement routes form a cycle; fix RETIREMENT_BY_ATOM_SLUG',
      { cycle: [...input.seen, retirement.into] },
    );

  return walkOneRetirementRoute({
    slug: retirement.into,
    seen: [...input.seen, retirement.into],
  });
};

/**
 * .what = casts any accepted slug name onto the pinned slug that serves it
 * .why = lets a consumer name a legacy, versionless, or retired slug and still
 *        reach a live model, so a provider's churn costs them no edit
 *
 * .the two steps:
 *   1. an ALIAS — legacy or versionless — is read from its map
 *   2. a ROUTED retirement is followed to its successor
 *
 * .note = an AMBIGUOUS retirement is NOT re-aimed here. it comes back
 *         unchanged, because it still serves — the probe on 2026-09-22
 *         confirmed every retired id answers. to throw now would break a
 *         caller whose model works, which is the exact churn this package
 *         exists to prevent. the named error is raised at the call site
 *         instead, once the id 404s (`getOneRetirementError`).
 *
 * .example
 *   asPinnedAtomSlug({ slug: 'fireworks/deepseek/v4.1-flash' })
 *     // 'fireworks/deepseek/flash/v4.1'   (legacy name)
 *   asPinnedAtomSlug({ slug: 'fireworks/deepseek/flash/latest' })
 *     // 'fireworks/deepseek/flash/v4.1'   (versionless generic)
 *   asPinnedAtomSlug({ slug: 'fireworks/deepseek/flash/v4' })
 *     // 'fireworks/deepseek/flash/v4.1'   (retired, routed)
 *   asPinnedAtomSlug({ slug: 'fireworks/kimi/pro/k2.6' })
 *     // 'fireworks/kimi/pro/k2.6'         (retired, ambiguous, still serves)
 */
export const asPinnedAtomSlug = (input: {
  slug: BrainAtomSlugFireworks;
}): BrainAtomSlugFireworksPinned => {
  // read the alias maps first, so a legacy or versionless name is made canonical
  const pinned = asCanonicalAtomSlug({ slug: input.slug });

  // then follow any retirement, since a canonical slug may be on its way out
  return walkOneRetirementRoute({ slug: pinned, seen: [pinned] });
};
