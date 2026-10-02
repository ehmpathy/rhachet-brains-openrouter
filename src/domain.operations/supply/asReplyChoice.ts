import type OpenAI from 'openai';

/**
 * .what = the first choice of a completion, or null where the body holds none
 * .why = openrouter can answer 200 with a body that carries no `choices` array at
 *        all (an `error` object in its place). the openai sdk types `choices` as
 *        always present, so a bare `choices[0]` crashes with a TypeError there
 *
 * .note = measured 2026-10-02: two of nine review lanes crashed on
 *         "Cannot read properties of undefined (reading '0')"
 * .note = the array is read as `unknown` first, so the guard is a real check
 *         rather than a cast the compiler would wave through
 * .note = one choice is the contract: no ask in this package sends `n`, so
 *         openrouter answers with one. an ask that sends `n > 1` must read the
 *         whole array, never this
 */
export const asReplyChoice = (input: {
  response: OpenAI.ChatCompletion;
}): OpenAI.ChatCompletion.Choice | null => {
  const choices: unknown = input.response.choices;
  if (!Array.isArray(choices)) return null;
  return choices[0] ?? null;
};
