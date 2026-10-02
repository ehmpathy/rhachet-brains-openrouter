import { ConstraintError } from 'helpful-errors';

import type { SdkOpenRouterEndpoints } from '../supply/sdkOpenRouterEndpoints';
import { getAllSimilarModelIds } from './getAllSimilarModelIds';

/**
 * .what = the model id, once openrouter's catalog confirms it lists it
 * .why = an unlisted slug may hold a typo; it must be refused before any spend,
 *        with the ids it likely meant, rather than 404 mid-ask (case=20)
 *
 * .note = each suggestion is a ready slug: `openrouter/` + the id + the
 *         caller's own filter segment, kept verbatim
 */
export const getOneCatalogModel = async (
  input: {
    model: string;
    filterSuffix: string;
    apiKey: string;
  },
  context: {
    sdkOpenRouterEndpoints: Pick<SdkOpenRouterEndpoints, 'getAllCatalogModels'>;
  },
): Promise<string> => {
  // read the cached catalog; a listed id passes
  const catalog = await context.sdkOpenRouterEndpoints.getAllCatalogModels({
    apiKey: input.apiKey,
  });
  if (catalog.some((model) => model.id === input.model)) return input.model;

  // refuse the unknown id, with the nearest undated ids as ready slugs
  const similar = getAllSimilarModelIds({
    id: input.model,
    catalog,
    limit: 5,
  }).map((id) => `openrouter/${id}${input.filterSuffix}`);
  throw new ConstraintError(
    [
      `openrouter lists no model '${input.model}'. no call was sent.`,
      '',
      'did you mean one of these?',
      ...similar.map((slug) => `  - ${slug}`),
      '',
      'see every id: https://openrouter.ai/models',
    ].join('\n'),
    { model: input.model, similar },
  );
};
