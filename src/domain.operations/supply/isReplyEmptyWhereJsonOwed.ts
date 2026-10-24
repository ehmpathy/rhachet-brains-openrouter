import type OpenAI from 'openai';

import { asReplyChoice } from './asReplyChoice';

/**
 * .what = did the host end a whole reply with no content where json was owed
 * .why = an empty `stop` reply falls between the prose check (non-empty text) and
 *        the failed check (`error` or none), so the walk read it as served and the
 *        defect check after the walk threw, with the next host unused (issue #24)
 *
 * .note = measured 2026-10: Morph, on deepseek-v4.1-flash, three of three json asks
 *         on one route, 0 chars after 24k–28k output tokens
 * .note = only `stop` counts. a reply cut at the output limit is the thought-exhausted
 *         case: another host would spend the same thought again, so it never steps
 * .note = a tool call request carries no content by design; a plain-string ask may
 *         answer '' legitimately
 */
export const isReplyEmptyWhereJsonOwed = (input: {
  response: OpenAI.ChatCompletion;
  expectsJson: boolean;
}): boolean => {
  // only an ask that owes json is broken by an empty reply
  if (!input.expectsJson) return false;

  // a tool call request carries no content by design
  const choice = asReplyChoice({ response: input.response });
  if (choice?.message?.tool_calls?.length) return false;

  // a whole reply, ended by the host, with no content
  const finishReason: string | null = choice?.finish_reason ?? null;
  if (finishReason !== 'stop') return false;
  return (choice?.message?.content ?? '').trim() === '';
};
