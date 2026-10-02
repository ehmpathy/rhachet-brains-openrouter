import { ConstraintError } from 'helpful-errors';
import type { IsoDateStamp } from 'iso-time';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import { getAllSimilarModelIds } from './getAllSimilarModelIds';

/**
 * .what = is a model withdrawn, per the catalog
 * .why = openrouter drops a withdrawn id from `/models`, or dates it with an
 *        `expiration_date` that has passed (F23)
 */
const isModelWithdrawn = (input: {
  listed: OpenRouterCatalogModel | null;
  today: IsoDateStamp;
}): boolean =>
  input.listed === null ||
  (input.listed.expiresOn !== null && input.listed.expiresOn <= input.today);

/**
 * .what = a named error for a model openrouter has withdrawn, or null
 * .why = a bare 404 leaves the caller to guess; this says the model is gone,
 *        since when, and offers the nearest live ids as ready slugs
 *
 * .note = returns null for a model the catalog still lists with no past date;
 *         that 404 is some other fault, and the caller rethrows it untouched
 */
export const getOneWithdrawnModelError = (input: {
  model: string;
  filterSuffix: string;
  catalog: OpenRouterCatalogModel[];
  today: IsoDateStamp;
  error: Error;
}): ConstraintError<{
  model: string;
  expiresOn: IsoDateStamp | null;
  similar: string[];
  cause: Error;
}> | null => {
  // a model the catalog still serves was not withdrawn
  const listed = input.catalog.find((m) => m.id === input.model) ?? null;
  if (!isModelWithdrawn({ listed, today: input.today })) return null;

  // name the nearest undated ids, as ready slugs
  const similar = getAllSimilarModelIds({
    id: input.model,
    catalog: input.catalog,
    limit: 5,
  }).map((id) => `openrouter/${id}${input.filterSuffix}`);
  const since = listed?.expiresOn
    ? `on ${listed.expiresOn}`
    : 'and no longer lists it';
  return new ConstraintError(
    [
      `openrouter withdrew '${input.model}' ${since}. it no longer serves.`,
      '',
      'switch to a live model, e.g.:',
      ...similar.map((slug) => `  - ${slug}`),
      '',
      'see every id: https://openrouter.ai/models',
    ].join('\n'),
    {
      model: input.model,
      expiresOn: listed?.expiresOn ?? null,
      similar,
      cause: input.error,
    },
  );
};
