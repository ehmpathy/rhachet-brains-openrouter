import { z } from 'zod';

import { asOpenRouterBodyChecked } from './asOpenRouterBodyChecked';

/**
 * .what = the fields this package reads from `/endpoints/zdr`
 * .why = openrouter's own field names; a row names its model and endpoint tag
 */
const SCHEMA_ZDR_BODY = z.object({
  data: z.array(
    z.object({
      model_id: z.string().nullish(),
      model: z.string().nullish(),
      tag: z.string().nullish(),
      provider_name: z.string().nullish(),
    }),
  ),
});

/**
 * .what = the zero-retention endpoint tags of each model, from the raw zdr list
 * .why = keep only what a privacy check reads: model → endpoint tags. the full
 *        list is ~1.17MB; this slim index is kilobytes
 *
 * .note = a row with no model or no tag can match no endpoint, so it is left out
 */
export const asZdrTagsByModel = (input: {
  body: unknown;
}): Record<string, string[]> => {
  // read each row as a (model, tag) pair
  const rows = asOpenRouterBodyChecked({
    body: input.body,
    schema: SCHEMA_ZDR_BODY,
    read: '/endpoints/zdr',
  })
    .data.map((raw) => ({
      model: raw.model_id ?? raw.model ?? null,
      tag: raw.tag ?? raw.provider_name ?? null,
    }))
    .filter((row) => row.model !== null && row.tag !== null);

  // group the tags under each model
  const models = [...new Set(rows.map((row) => row.model))];
  return Object.fromEntries(
    models.map((model) => [
      model,
      rows.filter((row) => row.model === model).map((row) => row.tag),
    ]),
  );
};
