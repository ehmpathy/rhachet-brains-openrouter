import { today } from 'iso-time';

import type { SdkOpenRouterEndpoints } from '../supply/sdkOpenRouterEndpoints';
import { getOneAccountError } from './getOneAccountError';
import { getOneWithdrawnModelError } from './getOneWithdrawnModelError';
import { isModelRefusal } from './isModelRefusal';

/**
 * .what = the error an ask should throw, named where its cause is known
 * .why = an account fault (402 no credits, 401 bad key) and a withdrawn model
 *        each get a named error with its fix; every other error is returned
 *        untouched, so the caller rethrows it as it came (`rule.forbid.failhide`)
 *
 * .note = only a refusal of the model costs a catalog read; the sdk is injected,
 *         so that read is visible at the call site and a test can fake it
 */
export const getOneAskErrorNamed = async (
  input: {
    error: unknown;
    model: string;
    filterSuffix: string;
    apiKey: string;
  },
  context: {
    sdkOpenRouterEndpoints: Pick<SdkOpenRouterEndpoints, 'getAllCatalogModels'>;
  },
): Promise<unknown> => {
  // a non-error throw is returned as it came
  if (!(input.error instanceof Error)) return input.error;

  // an account fault names its fix
  const accountError = getOneAccountError({ error: input.error });
  if (accountError) return accountError;

  // only a refusal of the model is checked against the catalog
  if (!isModelRefusal({ error: input.error })) return input.error;
  const catalog = await context.sdkOpenRouterEndpoints.getAllCatalogModels({
    apiKey: input.apiKey,
  });
  return (
    getOneWithdrawnModelError({
      model: input.model,
      filterSuffix: input.filterSuffix,
      catalog,
      today: today(),
      error: input.error,
    }) ?? input.error
  );
};
