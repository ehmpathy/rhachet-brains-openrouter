import type OpenAI from 'openai';

import { asReplyChoice } from './asReplyChoice';

/**
 * .what = whether a reply's text parses as json
 * .why = only a SyntaxError reads as not-json; every other error rethrows
 */
const isJsonText = (input: { content: string }): boolean => {
  try {
    JSON.parse(input.content);
    return true;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return false;
  }
};

/**
 * .what = did the host ignore the json schema asked for, and answer in prose
 * .why = a host can list `response_format` and still answer in prose (measured
 *        2026-10-02: Phala, on z-ai/glm-5.3-flash, 4 of 6 asks). that host broke
 *        the promise for this model, so the floor walk steps past it and the
 *        machine remembers it
 *
 * .note = only a whole reply in prose counts. a tool call request, a reply cut
 *         at the output limit, a reply that failed mid-way, and an empty reply
 *         each have their own name, and none proves the host ignores schemas
 */
export const isReplyJsonIgnored = (input: {
  response: OpenAI.ChatCompletion;
  expectsJson: boolean;
}): boolean => {
  // only an ask that owes json can ignore it
  if (!input.expectsJson) return false;

  // a tool call request carries no content by design
  const choice = asReplyChoice({ response: input.response });
  if (choice?.message?.tool_calls?.length) return false;

  // only a whole reply proves the schema was ignored
  const finishReason: string | null = choice?.finish_reason ?? null;
  if (finishReason !== 'stop') return false;
  const content = choice?.message?.content ?? '';
  if (content.trim() === '') return false;

  return !isJsonText({ content });
};
