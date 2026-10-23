import OpenAI from 'openai';

/**
 * .what = the `retry-after` a throttle sent, if any
 * .why = case=14 owes the caller the wait openrouter asked for, so a fleet backs
 *        off by the server's clock rather than a guess
 *
 * .note = the headers are checked at runtime, not trusted to the sdk's type: a
 *         shape other than `Headers`, or a blank value, reads as no wait at all
 */
export const asRetryAfter = (input: { error: unknown }): string | null => {
  if (!(input.error instanceof OpenAI.APIError)) return null;
  const headers: unknown = input.error.headers;
  if (!(headers instanceof Headers)) return null;
  const value = headers.get('retry-after');
  return value !== null && value.trim() !== '' ? value.trim() : null;
};
