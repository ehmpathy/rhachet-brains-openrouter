import type { OpenRouterCatalogModel } from '../../../domain.objects/OpenRouterCatalogModel';
import type { AtomTier } from './AtomSlug.bare';

/**
 * .what = the newest catalog id on a tier's model line, or null if none
 * .why = a tier reaches the latest model of its line with no version kept here;
 *        a model openrouter has dated for withdrawal is never picked, so a tier
 *        never lands on a scheduled break
 *
 * .note = newest by `createdAt`; iso timestamps of one format sort as strings
 */
export const getOneTierModelId = (input: {
  tier: Pick<AtomTier, 'line'>;
  catalog: OpenRouterCatalogModel[];
}): string | null =>
  input.catalog
    .filter((model) => input.tier.line.test(model.id))
    .filter((model) => model.expiresOn === null)
    .reduce<OpenRouterCatalogModel | null>(
      (newest, model) =>
        !newest || model.createdAt > newest.createdAt ? model : newest,
      null,
    )?.id ?? null;
