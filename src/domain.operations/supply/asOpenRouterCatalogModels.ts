import { asIsoDateStamp, asIsoTimeStamp } from 'iso-time';
import { z } from 'zod';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import { asOpenRouterBodyChecked } from './asOpenRouterBodyChecked';

/**
 * .what = the fields this package reads from `/models`
 * .why = the id, when openrouter added it, and the date it withdraws it (F23)
 *
 * .note = `created` is unix seconds, openrouter's own field
 */
const SCHEMA_MODELS_BODY = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      created: z.number(),
      expiration_date: z.string().nullish(),
    }),
  ),
});

/**
 * .what = every model openrouter lists, cast into the slim catalog shape
 * .why = keep only what a lookup reads: the id, its age, and its withdrawal date
 */
export const asOpenRouterCatalogModels = (input: {
  body: unknown;
}): OpenRouterCatalogModel[] =>
  asOpenRouterBodyChecked({
    body: input.body,
    schema: SCHEMA_MODELS_BODY,
    read: '/models',
  }).data.map((raw) => ({
    id: raw.id,
    createdAt: asIsoTimeStamp(new Date(raw.created * 1000)),
    expiresOn: raw.expiration_date ? asIsoDateStamp(raw.expiration_date) : null,
  }));
