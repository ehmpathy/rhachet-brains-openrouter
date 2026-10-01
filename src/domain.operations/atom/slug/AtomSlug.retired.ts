import type { BrainAtomSlugFireworksPinned } from '../BrainAtom.config';

/**
 * .what = the pinned slugs fireworks announced a retirement for
 * .why = names exactly which models are on the way out, so the registry below
 *        is a TOTAL record rather than a partial one full of undefined
 *
 * .note = a retirement is an announcement, never a tombstone — the id answers
 *         until fireworks actually withdraws it. live probe 2026-09-26:
 *         `glm/pro/5.2` still serves; `deepseek/flash/v4`, `deepseek/pro/v4`,
 *         `kimi/pro/k2.6`, and `kimi/code/k2.7` are WITHDRAWN (404). the routed
 *         one still reaches its successor; the three ambiguous ones raise the
 *         named error. all five stay listed in `getBrainAtomsByFireworksAI`,
 *         so a consumer's choice finds a brain either way.
 */
export type BrainAtomSlugFireworksRetired =
  | 'fireworks/deepseek/flash/v4'
  | 'fireworks/deepseek/pro/v4'
  | 'fireworks/glm/pro/5.2'
  | 'fireworks/kimi/pro/k2.6'
  | 'fireworks/kimi/code/k2.7';

/**
 * .what = what to do when a caller names a retired slug
 * .why = a retirement has exactly two honest outcomes, and they must not be
 *        confusable at a call site
 *
 * .kind ROUTED = fireworks named ONE successor, so we re-aim the caller onto it
 *        with no edit on their side.
 *
 * .kind AMBIGUOUS = there is no single correct successor. we do NOT pick one.
 *        🔴 a wrong alias is worse than an absent one, because it is silent —
 *        the caller gets different answers at a different price and never
 *        learns why. so the slug serves while it can, and the moment it 404s
 *        the caller gets an error that NAMES the candidates.
 */
export type AtomRetirementFireworks =
  | { kind: 'ROUTED'; into: BrainAtomSlugFireworksPinned; why: string }
  | { kind: 'AMBIGUOUS'; among: BrainAtomSlugFireworksPinned[]; why: string };

/**
 * .what = the retirement declared for each retired slug
 * .why = one place that answers "fireworks retires this — now what?"
 *
 * .note = the two ROUTED rows are the only ones where fireworks named a single
 *         successor. the three AMBIGUOUS rows each failed that test, for a
 *         reason recorded per row.
 *
 * .sources = fireworks deprecation notice, relayed 2026-09-22
 */
export const RETIREMENT_BY_ATOM_SLUG: Record<
  BrainAtomSlugFireworksRetired,
  AtomRetirementFireworks
> = {
  /**
   * .note = a clean swap. v4.1-flash carries the SAME rates ($0.22 input,
   *         $0.007 cached, $0.66 output) and the SAME 1M context, and it adds
   *         image input. so a routed caller loses naught and gains vision.
   */
  'fireworks/deepseek/flash/v4': {
    kind: 'ROUTED',
    into: 'fireworks/deepseek/flash/v4.1',
    why: 'deepseek v4 flash 0731 retired; v4.1-flash matches its rates and context, and adds vision',
  },

  /**
   * .note = same input and output rates ($1.40 / $4.40) and the same 1M
   *         context. ⚠️ the CACHED input rate rises, $0.14 -> $0.26, so a
   *         cache-heavy caller pays more after this route. that is the one
   *         cost regression in this table and it is documented in the readme.
   */
  'fireworks/glm/pro/5.2': {
    kind: 'ROUTED',
    into: 'fireworks/glm/pro/5.3',
    why: 'glm 5.2 retired; 5.3 matches its input and output rates and its 1M context',
  },

  /**
   * .note = fireworks pointed v4-pro at v4.1-flash, which is a TIER DROP, not a
   *         succession: frontier -> cheapfast, $1.32 -> $0.22 input, swe-bench
   *         80.6% -> unpublished. to route it silently would hand a caller who
   *         paid for frontier capacity a cheap model and bill them differently,
   *         with no signal. so it is not routed.
   */
  'fireworks/deepseek/pro/v4': {
    kind: 'AMBIGUOUS',
    among: ['fireworks/deepseek/flash/v4.1'],
    why: 'the only successor fireworks named is a tier drop (frontier -> cheapfast), not an equivalent',
  },

  /**
   * .note = fireworks named TWO successors. they are not interchangeable:
   *         kimi/k3 keeps the family and vision at 3x the input rate; glm/5.3
   *         is closer on price and 1M context but drops vision. only the
   *         caller knows which axis they care about.
   */
  'fireworks/kimi/pro/k2.6': {
    kind: 'AMBIGUOUS',
    among: ['fireworks/glm/pro/5.3', 'fireworks/kimi/pro/k3'],
    why: 'fireworks named two successors with different tradeoffs; only the caller can choose',
  },

  /**
   * .note = same two successors, same reason. and neither is code-specialized
   *         the way k2.7-code is, which makes the choice harder rather than
   *         easier.
   */
  'fireworks/kimi/code/k2.7': {
    kind: 'AMBIGUOUS',
    among: ['fireworks/glm/pro/5.3', 'fireworks/kimi/pro/k3'],
    why: 'fireworks named two successors with different tradeoffs, and neither is code-specialized',
  },
};

/**
 * .what = tells whether a pinned slug carries a retirement
 * .why = the resolver reads the registry only for slugs that have an entry, and
 *        a type guard narrows without an as-cast (`rule.forbid.as-cast`)
 */
export const isRetiredAtomSlug = (
  slug: string,
): slug is BrainAtomSlugFireworksRetired => slug in RETIREMENT_BY_ATOM_SLUG;
