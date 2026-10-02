import type OpenAI from 'openai';

/**
 * .what = a charge in usd, from a number or a numeric string
 * .why = openrouter sends `usage.cost` as a number today, yet sends its rates as
 *        strings; a string charge must not fall silently back to the estimate
 */
const asCostUsd = (input: { cost: unknown }): number | null => {
  if (typeof input.cost === 'number') return input.cost;
  if (typeof input.cost !== 'string' || input.cost.trim() === '') return null;
  const parsed = Number(input.cost);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * .what = the fields openrouter adds to an openai-shaped completion
 * .why = `provider` (who served), `usage.cost` (the charge), and `error` (why a
 *        200 holds no reply) are absent from the openai sdk's types; read them
 *        by an `in` guard, never by a cast
 */
export const asOpenRouterExtras = (input: {
  response: OpenAI.ChatCompletion;
}): {
  provider: string | null;
  costUsd: number | null;
  errorMessage: string | null;
} => {
  // who served the reply
  const provider =
    'provider' in input.response && typeof input.response.provider === 'string'
      ? input.response.provider
      : null;

  // what openrouter charged for it
  const usage = input.response.usage;
  const costUsd = asCostUsd({
    cost: usage && 'cost' in usage ? usage.cost : null,
  });

  // why openrouter returned no reply, where it put an error in a 200 body
  const error: unknown =
    'error' in input.response ? input.response.error : null;
  const errorMessage =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : null;

  return { provider, costUsd, errorMessage };
};
