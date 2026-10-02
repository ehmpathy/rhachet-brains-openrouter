import type OpenAI from 'openai';

import { asReplyChoice } from './asReplyChoice';

/**
 * .what = did the upstream host fail mid-reply
 * .why = openrouter answers 200 when a host fails after it began: the reply
 *        ends with `finish_reason: 'error'`, or carries no choice at all (even no
 *        `choices` array: an `error` object in its place). such a
 *        host did not serve, so the floor walk steps past it, and the caller is
 *        told the reply is unfit to read
 *
 * .note = a reply that requests tool calls is never a failure; its content is
 *         empty by design
 * .note = openrouter reports 'error', a value absent from the openai sdk's union
 * .note = measured 2026-10-02: one host failed this way on five of nine ~300k-token
 *         review asks, after 1 output token, though it declares a 1.04M context
 */
export const isReplyFailed = (input: {
  response: OpenAI.ChatCompletion;
}): boolean => {
  // a tool call request carries no content by design
  const choice = asReplyChoice({ response: input.response });
  if (choice?.message?.tool_calls?.length) return false;

  // a reply that ended in error, or never ended at all, failed
  const finishReason: string | null = choice?.finish_reason ?? null;
  return finishReason === 'error' || finishReason === null;
};
