import { MalfunctionError } from 'helpful-errors';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';

/**
 * .what = the admitted endpoint that served this answer
 * .why = an answer from a provider outside the admitted set means a promise already
 *        broke, so it is withheld — the caller must never read it (case=22, F14)
 *
 * .note = openrouter names the served PROVIDER, not the endpoint; two endpoints of
 *         one provider cannot be told apart here, so the first match is returned.
 *         the admitted set is rank-ordered, so that is the cheapest match. the floor
 *         admits one endpoint per hop, so on its path the match is exact (F29)
 * .note = a reply that names NO provider is withheld too (fail closed), under its
 *         own message: it proves neither a breach nor a keep, and a caller who
 *         reads "served from 'null'" chases a breach that never happened
 */
export const getOneServedEndpoint = (input: {
  provider: string | null;
  admitted: OpenRouterEndpoint[];
  generationId: string | null;
}): OpenRouterEndpoint => {
  const admittedTags = input.admitted.map((e) => `'${e.tag}'`).join(', ');
  const audit = `audit: https://openrouter.ai/activity — generation ${input.generationId ?? '(none)'}`;

  // withhold an answer whose provider openrouter did not name
  if (input.provider === null)
    throw new MalfunctionError(
      [
        `openrouter's reply named no provider, so it cannot be proven among admitted ${admittedTags}. the answer is withheld.`,
        '',
        'fix: retry the ask. if it recurs, openrouter has changed its reply shape',
        audit,
      ].join('\n'),
      {
        provider: null,
        admitted: input.admitted.map((e) => e.tag),
        generationId: input.generationId,
      },
    );

  // withhold an answer from a provider the ask never admitted
  const served = input.admitted.find((e) => e.providerName === input.provider);
  if (!served)
    throw new MalfunctionError(
      [
        `openrouter served from '${input.provider}', yet the ask admitted only ${admittedTags}. the answer is withheld.`,
        '',
        'fix: retry the ask. openrouter served outside the admitted set, so report the generation below to openrouter if it recurs',
        audit,
      ].join('\n'),
      {
        provider: input.provider,
        admitted: input.admitted.map((e) => e.tag),
        generationId: input.generationId,
      },
    );
  return served;
};
