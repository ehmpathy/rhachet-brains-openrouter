import OpenAI from 'openai';

/**
 * .what = does this failure say openrouter refused the model itself
 * .why = only a refusal is worth a catalog read; any other failure rethrows
 *        untouched, and is never masked by a second network read
 *
 * .note = a 404, or a message that names a deprecation (openrouter's words:
 *         "This model has been deprecated")
 */
export const isModelRefusal = (input: { error: unknown }): boolean =>
  input.error instanceof OpenAI.APIError &&
  (input.error.status === 404 || /deprecat/i.test(input.error.message));
