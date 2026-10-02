import { ConstraintError } from 'helpful-errors';

import type { SdkOpenRouterEndpoints } from '../supply/sdkOpenRouterEndpoints';
import {
  type BrainAtomSlugOpenRouterBare,
  TIER_BY_BARE_SLUG,
} from './slug/AtomSlug.bare';
import { getOneTierModelId } from './slug/getOneTierModelId';

/**
 * .what = the model a tier reaches on this machine this week
 * .why = a tier names a model line, never a version; openrouter's catalog says
 *        which model is newest. the pick is held 7 days on disk, so a new
 *        release never swaps the model under a caller mid-task
 *
 * .note = a held pick that openrouter has since dropped, or dated for
 *         withdrawal, is discarded and the tier is picked again, at once
 * .note = a tier whose line matches no model is refused before any spend,
 *         with the line it looked for
 */
export const getOneTierModel = async (
  input: {
    tier: BrainAtomSlugOpenRouterBare;
    apiKey: string;
  },
  context: {
    sdkOpenRouterEndpoints: Pick<
      SdkOpenRouterEndpoints,
      'getAllCatalogModels' | 'getOneTierPick' | 'setOneTierPick'
    >;
  },
): Promise<string> => {
  // read the catalog and this machine's held pick
  const [catalog, held] = await Promise.all([
    context.sdkOpenRouterEndpoints.getAllCatalogModels({
      apiKey: input.apiKey,
    }),
    context.sdkOpenRouterEndpoints.getOneTierPick({ tier: input.tier }),
  ]);

  // keep the held pick while openrouter still lists it, undated
  const heldListed = catalog.find((model) => model.id === held);
  if (heldListed && heldListed.expiresOn === null) return heldListed.id;

  // pick the newest model on the tier's line
  const line = TIER_BY_BARE_SLUG[input.tier].line;
  const picked = getOneTierModelId({ tier: { line }, catalog });
  if (!picked)
    throw new ConstraintError(
      [
        `openrouter lists no live model for '${input.tier}'. no call was sent.`,
        '',
        `the tier looks for the newest undated id that matches ${line}`,
        '',
        'fix: name an openrouter id directly, e.g. openrouter/{author}/{model}',
        'see every id: https://openrouter.ai/models',
      ].join('\n'),
      { tier: input.tier, line: String(line) },
    );

  // hold the pick for 7 days on this machine
  await context.sdkOpenRouterEndpoints.setOneTierPick({
    tier: input.tier,
    model: picked,
  });
  return picked;
};
