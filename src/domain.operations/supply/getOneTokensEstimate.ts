import type OpenAI from 'openai';

/**
 * .what = how many characters make one token, on average
 * .why = a common rule of thumb for english and code; the estimate is for the
 *        report, never for the bill
 */
const CHARS_PER_TOKEN = 4;

/**
 * .what = estimates an ask's input token count from its messages
 * .why = the floor ranks endpoints by input cost alone (F20, wisher ruled);
 *        the estimate is reported so the caller sees what the rank assumed
 *
 * .note = deterministic: a serialization's LENGTH does not depend on key order,
 *         since a reorder keeps every character. only the content moves it
 */
export const getOneTokensEstimate = (input: {
  request: OpenAI.ChatCompletionCreateParamsNonStreaming;
}): { input: number } => ({
  input: Math.ceil(
    JSON.stringify(input.request.messages).length / CHARS_PER_TOKEN,
  ),
});
