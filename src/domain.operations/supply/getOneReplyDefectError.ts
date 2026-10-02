import { MalfunctionError } from 'helpful-errors';
import type OpenAI from 'openai';

import { asOpenRouterExtras } from './asOpenRouterExtras';
import { asReplyChoice } from './asReplyChoice';
import { isReplyFailed } from './isReplyFailed';

/**
 * .what = builds the error that names a reply openrouter returned unfit to read, or null
 * .why = openrouter can answer 200 with no reply: an upstream provider that fails
 *        mid-reply (`finish_reason: 'error'`), or a reply cut at the output limit
 *        (`finish_reason: 'length'`). read as `''`, either one surfaced as a bare
 *        `SyntaxError: Unexpected end of JSON input`, with no provider, no generation
 *        id, and no cause. name all three, so the fault is diagnosable from the error
 *
 * .note = returns null on a sound reply, and on a reply that requests tool calls
 *         (their content is empty by design), so the call site proceeds untouched
 * .note = an empty reply is a defect only where json is owed; a plain-string ask
 *         may legitimately answer '' with `finish_reason: 'stop'`
 */
export const getOneReplyDefectError = (input: {
  response: OpenAI.ChatCompletion;
  supply: { provider: string | null; generationId: string | null };
  expectsJson: boolean;
}): MalfunctionError<{
  finishReason: string | null;
  provider: string | null;
  generationId: string | null;
  contentLength: number;
  tokensOutput: number | null;
  errorMessage: string | null;
}> | null => {
  // a tool call request carries no content by design
  const choice = asReplyChoice({ response: input.response });
  if (choice?.message?.tool_calls?.length) return null;

  // read the evidence: why the reply ended, what it held, and what openrouter said
  // .note = openrouter reports 'error', a value absent from the openai sdk's union
  const finishReason: string | null = choice?.finish_reason ?? null;
  const content = choice?.message?.content ?? '';
  const { errorMessage } = asOpenRouterExtras({ response: input.response });
  const evidence = {
    finishReason,
    provider: input.supply.provider,
    generationId: input.supply.generationId,
    contentLength: content.length,
    tokensOutput: input.response.usage?.completion_tokens ?? null,
    errorMessage,
  };
  const audit = `audit: https://openrouter.ai/activity — generation ${input.supply.generationId ?? '(none)'}, provider ${input.supply.provider ?? '(unknown)'}`;

  // a reply cut at the output limit is partial, so it cannot be trusted
  if (finishReason === 'length')
    return new MalfunctionError(
      [
        `openrouter's reply was cut off at the output limit (finish_reason=length), after ${evidence.tokensOutput ?? '?'} output tokens. the partial reply is withheld.`,
        '',
        'fix: ask for a shorter reply, or choose a model with a larger output limit',
        audit,
      ].join('\n'),
      evidence,
    );

  // a provider that failed mid-reply, or a reply that came back empty where json is owed
  const isFailed = isReplyFailed({ response: input.response });
  const isEmptyWhereJsonOwed = input.expectsJson && content.trim() === '';
  if (isFailed || isEmptyWhereJsonOwed)
    return new MalfunctionError(
      [
        `openrouter returned no usable reply (finish_reason=${finishReason ?? 'none'}, ${content.length} chars). ${isFailed ? 'the upstream provider likely failed mid-reply.' : 'the host replied empty where a json schema was owed.'}`,
        ...(errorMessage ? [`openrouter said: ${errorMessage}`] : []),
        '',
        'fix: retry the ask. if it recurs, admit other providers via filters, or choose another model',
        audit,
      ].join('\n'),
      evidence,
    );

  // a host that ignored the json schema: it lists the param, yet replied in prose
  if (input.expectsJson && !isJsonText({ content }))
    return new MalfunctionError(
      [
        `openrouter's host ${input.supply.provider ?? '(unknown)'} ignored the json schema asked for, and replied in plain text (${content.length} chars). the reply is withheld.`,
        '',
        'fix: ask via a floor slug — the floor walk steps past a host that answers prose, and skips it for 7 days. or ask for z.string() and parse the reply yourself',
        audit,
      ].join('\n'),
      evidence,
    );

  // the reply is sound
  return null;
};

/**
 * .what = whether a reply's text parses as json
 * .why = a host can list `response_format` and still answer in prose (measured
 *        2026-10-02: Phala, on z-ai/glm-5.3-flash, 4 of 6 asks). that reply must
 *        be named for the host that broke the promise, not left to a bare parse
 *
 * .note = only a SyntaxError reads as not-json; every other error rethrows
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
