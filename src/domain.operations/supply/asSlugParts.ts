import { ConstraintError } from 'helpful-errors';

import { asSupplyFilters, type SupplyFilters } from './asSupplyFilters';

/**
 * .what = is this slug segment a filter segment
 * .why = one filter-shaped word (`floor`, `key=value`, or an `&` join) marks the
 *        whole segment as filters, so a bad word beside it is refused at parse
 *        and named (case=3) — never misread as a model name. a segment with no
 *        such word (`latest`, a tier, a model name) is part of the base
 *
 * .note = openrouter ids never hold `&` or `=`, so neither can misfire on one
 */
const isFilterSegment = (input: { segment: string }): boolean =>
  input.segment.includes('&') ||
  input.segment
    .split('&')
    .some((word) => word === 'floor' || word.includes('='));

/**
 * .what = splits a slug into its base slug and its supply filters
 * .why = filters ride at the slug's tail; the base names the model
 *
 * .example
 *   asSlugParts({ slug: 'openrouter/deepseek/flash/floor&speed=min50tps' })
 *   // { base: 'openrouter/deepseek/flash', filters: { floor: true, ... },
 *   //   filterSuffix: '/floor&speed=min50tps' }
 *   asSlugParts({ slug: 'openrouter/deepseek/flash' })
 *   // { base: 'openrouter/deepseek/flash', filters: null, filterSuffix: '' }
 *
 * .note = `filterSuffix` is the filter segment verbatim, with its slash, so a
 *         refusal can offer a ready slug that keeps the caller's own filters
 */
export const asSlugParts = (input: {
  slug: string;
}): { base: string; filters: SupplyFilters | null; filterSuffix: string } => {
  // a pattern names no model
  if (input.slug.split('/').includes('*'))
    throw new ConstraintError(
      `'${input.slug}' is a routed pattern, not a model. fill the shape openrouter/{author}/{model}[/{filters}], e.g. openrouter/deepseek/flash/floor`,
      { slug: input.slug },
    );

  // the filters start at the first filter-shaped segment, and run to the end
  // .note = never "the last segment": a filter word may hold a slash itself
  //         (`price.max=0.5usd/M`), so the tail past it is still filters
  const segments = input.slug.split('/');
  const filtersAt = segments.findIndex(
    (segment, index) => index > 0 && isFilterSegment({ segment }),
  );

  // no filter-shaped segment: all is base
  if (filtersAt === -1)
    return { base: input.slug, filters: null, filterSuffix: '' };
  const segmentFilters = segments.slice(filtersAt).join('/');
  return {
    base: segments.slice(0, filtersAt).join('/'),
    filters: asSupplyFilters({ segment: segmentFilters }),
    filterSuffix: `/${segmentFilters}`,
  };
};
