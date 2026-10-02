import { ConstraintError } from 'helpful-errors';
import type { BrainSpec } from 'rhachet/brains';

import { asSlugParts } from '../supply/asSlugParts';
import {
  asSupplyFilters,
  SUPPLY_FILTERS_DEFAULT_SEGMENT,
  type SupplyFilters,
} from '../supply/asSupplyFilters';
import {
  type BrainAtomSlugOpenRouterBare,
  TIER_BY_BARE_SLUG,
} from './slug/AtomSlug.bare';
import {
  asUnlistedModelId,
  SPEC_ESTIMATE_UNLISTED,
} from './slug/AtomSlug.unlisted';
import { getAllAtomSlugs } from './slug/getAllAtomSlugs';

/**
 * .what = casts a slug into the target it names: a tier or a model, its spec, and its supply filters
 * .why = parse once, at build: a malformed filter or a shape that names no
 *        model is refused before the atom exists. a slug names either a tier
 *        (its model read from the catalog at ask) or any openrouter id (checked
 *        against the catalog at ask); one shape for both
 *
 * .note = a tier name wins over the unlisted read of the same shape, so
 *         `openrouter/deepseek/flash` is the tier, never an id `deepseek/flash`
 * .note = exactly one of `tier` and `model` is set: a tier's model is unknown
 *         until the ask reads the catalog
 */
export const asAtomTarget = (input: {
  slug: string;
}): {
  tier: BrainAtomSlugOpenRouterBare | null; // null for an unlisted id
  model: string | null; // the unlisted id; null for a tier, read at ask
  spec: BrainSpec;
  description: string;
  filters: SupplyFilters; // the slug's own, else the default supply filters
  filterSuffix: string; // the slug's own filter segment, with its slash, or ''
} => {
  // split off the supply filters; a malformed filter is refused here
  const parts = asSlugParts({ slug: input.slug });
  const { base, filterSuffix } = parts;

  // a slug with no filters of its own takes the default supply filters
  const filters =
    parts.filters ??
    asSupplyFilters({ segment: SUPPLY_FILTERS_DEFAULT_SEGMENT });

  // a tier name reaches the newest model of its line, read at ask
  const tier = getAllAtomSlugs().find((slug) => slug === base);
  if (tier) {
    const { description, spec, line } = TIER_BY_BARE_SLUG[tier];
    return {
      tier,
      model: null,
      spec,
      description: `${description} (${input.slug} -> newest ${line} on openrouter; spec is a tier estimate, the real charge lands in metrics)`,
      filters,
      filterSuffix,
    };
  }

  // any other openrouter id is unlisted: its spec is an estimate
  const model = asUnlistedModelId({ base });
  if (model)
    return {
      tier: null,
      model,
      spec: SPEC_ESTIMATE_UNLISTED,
      description: `${model} - unlisted openrouter model; spec is an estimate, the real charge lands in metrics`,
      filters,
      filterSuffix,
    };

  // a shape that names no model is refused, with both forms that would work
  const valid = getAllAtomSlugs();
  throw new ConstraintError(
    [
      `'${input.slug}' names no openrouter model.`,
      '',
      'name one of these, each with an optional /{filters} segment:',
      '  - a tier:',
      ...valid.map((slug) => `      ${slug}`),
      '  - any openrouter id: openrouter/{author}/{model}, e.g. openrouter/z-ai/glm-5.3',
    ].join('\n'),
    { slug: input.slug, valid },
  );
};
