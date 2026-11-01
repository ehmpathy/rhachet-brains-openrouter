import { MalfunctionError } from 'helpful-errors';
import type OpenAI from 'openai';

import { asTokensThought } from '../../infra/cast/asTokensThought';
import { asOpenRouterExtras } from './asOpenRouterExtras';
import { asReplyChoice } from './asReplyChoice';
import { isJsonText } from './isJsonText';
import { isReplyFailed } from './isReplyFailed';
import { isThoughtCapIgnored } from './isThoughtCapIgnored';

// the largest budget the all-thought fix suggests; the measured review ask needs 6000 (case=1)
const THOUGHT_BUDGET_SUGGESTED_MAX = 8_000;

/**
 * .what = a thought budget to suggest, from the output room the host had
 * .why = case=2: the fix names a number, not a placeholder. three quarters of the room leaves
 *        a quarter for the answer; rounded down to the hundred, so it reads as a suggestion.
 *        capped, since a host's output room can reach 384k+ tokens (q6), and a budget that
 *        large repeats the very spend the cap exists to end
 */
const asThoughtBudgetSuggested = (input: {
  tokensOutput: number | null;
}): number | 'N' =>
  input.tokensOutput && input.tokensOutput >= 400
    ? Math.min(
        Math.floor((input.tokensOutput * 0.75) / 100) * 100,
        THOUGHT_BUDGET_SUGGESTED_MAX,
      )
    : 'N';

/**
 * .what = the fix line for an all-thought reply, per what the ask set
 * .why = case=2: unset names a budget; a level names a lower level or a budget; a budget the
 *        host honored names a lower one; a budget the host overran names the host, since a
 *        lower budget it ignores is no fix
 */
const asAllThoughtFix = (input: {
  tokensThought: number | null;
  tokensOutput: number | null;
  tokensThoughtBudget: number | null;
  thoughtLevel: string | null;
}): string => {
  const budgetSuggested = asThoughtBudgetSuggested({
    tokensOutput: input.tokensOutput,
  });
  const askWithBudget = `  atom.ask({ ...input, effort: { budget: { tokens: ${budgetSuggested} } } })`;

  // the ask set the lowest level: no lower one exists, so name a budget
  if (input.thoughtLevel === 'minimal')
    return `fix: effort is already at its lowest level ('minimal'). set a budget so the answer has space —\n${askWithBudget}`;

  // the ask set a level: name a lower one, or a budget
  if (input.thoughtLevel !== null)
    return `fix: lower effort (now '${input.thoughtLevel}'), or set a budget so the answer has space —\n${askWithBudget}`;

  // the ask set no cap: name a budget
  if (input.tokensThoughtBudget === null)
    return `fix: budget thought below the output room, so the answer has space —\n${askWithBudget}`;

  // the host thought far past the budget: it did not honor the cap
  if (isThoughtCapIgnored(input))
    return `fix: the host did not honor effort.budget.tokens (${input.tokensThought} thought against a budget of ${input.tokensThoughtBudget}), so a lower budget will not help. admit other providers via filters, or choose another model`;

  // the host honored the budget, and it still filled the room
  return `fix: lower effort.budget.tokens (now ${input.tokensThoughtBudget}), so the answer has space`;
};

/**
 * .what = the fix line for a reply cut mid-answer at the output limit
 * .why = a cut reply that was mostly thought is the all-thought case one step short: its
 *        fix is a thought cap, never a shorter reply. a reply mostly answer wants less answer
 */
const asCutOffFix = (input: {
  tokensThought: number | null;
  tokensOutput: number | null;
}): string =>
  input.tokensThought !== null &&
  input.tokensOutput !== null &&
  input.tokensThought * 2 >= input.tokensOutput
    ? `fix: cap thought (effort on the ask), since ${input.tokensThought} of ${input.tokensOutput} output tokens were thought, so the answer has room`
    : 'fix: ask for a shorter reply, or choose a model with a larger output limit';

/**
 * .what = the evidence a reply defect error carries, with the kind a caller branches on
 */
type ReplyDefectMetadata = {
  defect: 'all-thought' | 'cut-off' | 'failed' | 'empty' | 'prose';
  finishReason: string | null;
  provider: string | null;
  generationId: string | null;
  contentLength: number;
  tokensOutput: number | null;
  tokensThought: number | null;
  tokensThoughtBudget: number | null;
  thoughtLevel: string | null;
  errorMessage: string | null;
  costUsd: number | null; // what openrouter billed for this reply, thought included
};

/**
 * .what = builds the error that names a reply openrouter returned unfit to read, or null
 * .why = openrouter can answer 200 with no reply: an upstream provider that fails
 *        mid-reply (`finish_reason: 'error'`), or a reply cut at the output limit
 *        (`finish_reason: 'length'`). read as `''`, either one surfaced as a bare
 *        `SyntaxError: Unexpected end of JSON input`, with no provider, no generation
 *        id, and no cause. name all three, so the fault is diagnosable from the error
 *
 * .note = `metadata.defect` names the kind, so a caller branches on it, never on the text
 * .note = returns null on a sound reply, and on a reply that requests tool calls
 *         (their content is empty by design), so the call site proceeds untouched
 * .note = an empty reply is a defect only where json is owed; a plain-string ask
 *         may legitimately answer '' with `finish_reason: 'stop'`
 * .note = a `length` reply with no answer is the all-thought case (case=2): the host
 *         spent the whole output room on thought. it is named apart from a reply cut
 *         mid-answer, since its fix is a thought cap, never a shorter reply
 */
export const getOneReplyDefectError = (input: {
  response: OpenAI.ChatCompletion;
  supply: { provider: string | null; generationId: string | null };
  expectsJson: boolean;
  tokensThoughtBudget: number | null; // the ask's `effort.budget.tokens`, if any
  thoughtLevel: string | null; // the ask's `effort.level`, if any
}): MalfunctionError<ReplyDefectMetadata> | null => {
  // a tool call request carries no content by design
  const choice = asReplyChoice({ response: input.response });
  if (choice?.message?.tool_calls?.length) return null;

  // read the evidence: why the reply ended, what it held, and what openrouter said
  // .note = openrouter reports 'error', a value absent from the openai sdk's union
  const finishReason: string | null = choice?.finish_reason ?? null;
  const content = choice?.message?.content ?? '';
  const { errorMessage, costUsd } = asOpenRouterExtras({
    response: input.response,
  });
  const evidence = {
    finishReason,
    provider: input.supply.provider,
    generationId: input.supply.generationId,
    contentLength: content.length,
    tokensOutput: input.response.usage?.completion_tokens ?? null,
    tokensThought: asTokensThought({ usage: input.response.usage }),
    tokensThoughtBudget: input.tokensThoughtBudget,
    thoughtLevel: input.thoughtLevel,
    errorMessage,
    costUsd,
  };
  const audit = `audit: https://openrouter.ai/activity — generation ${input.supply.generationId ?? '(none)'}, provider ${input.supply.provider ?? '(unknown)'}`;

  // a reply that hit the output limit before it wrote any answer: all thought
  if (finishReason === 'length' && content.trim() === '')
    return new MalfunctionError<ReplyDefectMetadata>(
      [
        `openrouter's host spent the whole reply on thought, and wrote no answer (${evidence.tokensThought ?? '?'} of ${evidence.tokensOutput ?? '?'} output tokens were thought; finish_reason=length; 0 chars of answer)${evidence.costUsd !== null ? `, billed $${evidence.costUsd}` : ''}.`,
        '',
        asAllThoughtFix(evidence),
        audit,
      ].join('\n'),
      { defect: 'all-thought', ...evidence },
    );

  // a reply cut at the output limit mid-answer is partial, so it cannot be trusted
  // .note = a host that reports no thought count gets no thought note, as in 0.1.3
  const thoughtNote =
    evidence.tokensThought === null
      ? ''
      : ` (${evidence.tokensThought} of them thought)`;
  if (finishReason === 'length')
    return new MalfunctionError<ReplyDefectMetadata>(
      [
        `openrouter's reply was cut off at the output limit (finish_reason=length), after ${evidence.tokensOutput ?? '?'} output tokens${thoughtNote}. the partial reply is withheld.`,
        '',
        asCutOffFix(evidence),
        audit,
      ].join('\n'),
      { defect: 'cut-off', ...evidence },
    );

  // a provider that failed mid-reply, or a reply that came back empty where json is owed
  const isFailed = isReplyFailed({ response: input.response });
  const isEmptyWhereJsonOwed = input.expectsJson && content.trim() === '';
  if (isFailed || isEmptyWhereJsonOwed)
    return new MalfunctionError<ReplyDefectMetadata>(
      [
        `openrouter returned no usable reply (finish_reason=${finishReason ?? 'none'}, ${content.length} chars). ${isFailed ? 'the upstream provider likely failed mid-reply.' : 'the host replied empty where a json schema was owed.'}`,
        ...(errorMessage ? [`openrouter said: ${errorMessage}`] : []),
        '',
        'fix: retry the ask. if it recurs, admit other providers via filters, or choose another model',
        audit,
      ].join('\n'),
      { defect: isFailed ? 'failed' : 'empty', ...evidence },
    );

  // a host that ignored the json schema: it lists the param, yet replied in prose
  if (input.expectsJson && !isJsonText({ content }))
    return new MalfunctionError<ReplyDefectMetadata>(
      [
        `openrouter's host ${input.supply.provider ?? '(unknown)'} ignored the json schema asked for, and replied in plain text (${content.length} chars). the reply is withheld.`,
        '',
        'fix: ask via a floor slug — the floor walk steps past a host that answers prose, and skips it for 7 days. or ask for z.string() and parse the reply yourself',
        audit,
      ].join('\n'),
      { defect: 'prose', ...evidence },
    );

  // the reply is sound
  return null;
};
