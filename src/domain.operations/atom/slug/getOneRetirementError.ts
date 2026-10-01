import { BadRequestError } from 'helpful-errors';
import OpenAI from 'openai';

import type { BrainAtomSlugFireworksPinned } from '../BrainAtom.config';
import { isRetiredAtomSlug, RETIREMENT_BY_ATOM_SLUG } from './AtomSlug.retired';

/**
 * .what = tells whether a provider error means "this model is gone"
 * .why = fireworks reports a withdrawn model as a 404, so that status is the
 *        one signal that a retirement has moved from announced to effective
 *
 * .note = matches on the message too, never on status alone. the openai client
 *         surfaces a fireworks 404 as `404 Model not found, inaccessible,
 *         and/or not deployed`, and a transport that loses the status still
 *         carries that text.
 */
const isModelAbsentError = (input: { error: Error }): boolean => {
  if (input.error instanceof OpenAI.APIError && input.error.status === 404)
    return true;
  return /not found|not deployed|inaccessible/i.test(input.error.message);
};

/**
 * .what = builds the error that names a caller's successor choice, or null
 * .why = a model retired with no single successor must fail LOUD and NAMED.
 *        the opaque `404 Model not found` fireworks returns tells a caller
 *        naught about what to reach for instead
 *
 * .note = returns null when no enrichment applies, so the call site rethrows
 *         the original untouched. this never swallows an error
 *         (`rule.forbid.failhide`) — it only adds the fix to one it recognizes.
 *
 * .note = fires only for an AMBIGUOUS retirement. a ROUTED one never reaches
 *         the api under its old slug, because the resolver re-aimed it first.
 */
export const getOneRetirementError = (input: {
  slug: BrainAtomSlugFireworksPinned;
  error: Error;
}): BadRequestError | null => {
  // only a retired slug can carry a retirement message
  if (!isRetiredAtomSlug(input.slug)) return null;

  // a routed retirement never reaches the api, so only ambiguous ones land here
  const retirement = RETIREMENT_BY_ATOM_SLUG[input.slug];
  if (retirement.kind !== 'AMBIGUOUS') return null;

  // any other failure is unrelated to the retirement, so leave it alone
  if (!isModelAbsentError({ error: input.error })) return null;

  const choices = retirement.among.map((slug) => `  - ${slug}`).join('\n');
  return new BadRequestError(
    [
      `'${input.slug}' was retired by fireworks and no longer serves.`,
      '',
      `why no automatic route: ${retirement.why}.`,
      '',
      'pick the successor that fits your use, then pass it as your slug:',
      choices,
      '',
      'to never hit this again, name a versionless slug instead — e.g.',
      "genBrainAtom({ slug: 'fireworks/deepseek/flash/latest' })",
    ].join('\n'),
    {
      slug: input.slug,
      among: retirement.among,
      why: retirement.why,
      cause: input.error,
    },
  );
};
