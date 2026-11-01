import { MalfunctionError } from 'helpful-errors';
import { asDurationInWords, type IsoDuration } from 'iso-time';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import type { HostFault } from '../../domain.objects/HostFault';
import { asHostFault } from './asHostFault';
import { asHostFaultReason } from './asHostFaultReason';
import { getOneStallCount } from './getOneStallCount';

/**
 * .what = how the headline names each host fault
 * .why = a Record is total, so a new HostFault fails to compile until it is named here
 * .note = prose and empty share one phrase: both are a json ask the host did not answer
 */
const PHRASE_BY_FAULT: Record<HostFault, string> = {
  throttled: 'rate limited',
  refused: 'refused',
  failed: 'failed (mid-reply or with its own error)',
  'body-cut': 'cut its body',
  stalled: 'stalled',
  prose: 'answered prose or 0 chars where json was owed',
  empty: 'answered prose or 0 chars where json was owed',
};

/**
 * .what = the outcome column width: the longest fault name, plus one
 * .why = derived from the Record, so a longer new name never breaks the column
 */
const OUTCOME_COLUMN = Math.max(
  ...Object.keys(PHRASE_BY_FAULT).map((fault) => fault.length),
);

/**
 * .what = every fault phrase, once each, as one english list
 * .why = the headline must name each way a host can fail, and stay true as one is added
 */
const asFaultPhraseList = (): string => {
  const phrases = [...new Set(Object.values(PHRASE_BY_FAULT))];
  return `${phrases.slice(0, -1).join(', ')}, or ${phrases.at(-1)}`;
};

/**
 * .what = the fix line for a supply that served no answer
 * .why = three cases, each with its own lever:
 *        - a walk cut short by stalls left hosts untried, so a looser promise only
 *          adds hosts to stall on
 *        - a last host 400 may name the request itself (a prompt over the context
 *          window), so the request is named before a retry
 *        - all else is a retry by openrouter's clock, or a looser promise
 */
const asFix = (input: {
  untried: number;
  retryAfter: string | null;
  isRequestNamed: boolean;
}): string => {
  if (input.untried > 0)
    return `fix: retry later; ${input.untried} qualified ${input.untried === 1 ? 'host was' : 'hosts were'} left untried, so a looser promise would not help.`;
  const retry = input.retryAfter
    ? `retry after ${input.retryAfter}s (openrouter's retry-after), or loosen a promise so more endpoints qualify.`
    : 'retry later, or loosen a promise so more endpoints qualify.';
  if (input.isRequestNamed)
    return `fix: if the last host fault names your request (e.g. a context limit), fix the request; else ${retry}`;
  return `fix: ${retry}`;
};

/**
 * .what = the error for a supply that tried every qualified endpoint — the floor
 *         walk, or the admitted set once each host faulted
 * .why = the caller sees each hop and its outcome, the wait openrouter asked for,
 *        and the last host's own reason, so the fix is a retry by the server's
 *        clock (case=14) — or a fix to the request, when the last host rejected
 *        the request itself (a prompt over the context window)
 *
 * .note = the last host's error rides as `cause`, so its status, headers, and
 *         body stay readable; the message names the class a caller branches on
 * .note = the request is named in the fix only after a host 400 (`failed`): a
 *         throttle or a refusal never blames the request
 * .note = a stall names the bound and the thought cap: the lever for a slow answer
 *         is a cap on thought, never a longer bound (case=9)
 * .note = `untried` counts the qualified hosts the walk never reached: it stops after
 *         two stalls, since each costs a full per-hop bound
 */
export const getOneFloorExhaustedError = (input: {
  model: string;
  attempts: FloorAttempt[];
  retryAfter: string | null;
  faultLast: Error | null; // the last host fault's own error
  untried: number;
  bound: IsoDuration; // the per-hop bound a stalled host ran out
}): MalfunctionError<{
  model: string;
  attempts: FloorAttempt[];
  retryAfter: string | null;
  faultReasonLast: string | null;
  untried: number;
  bound: IsoDuration;
  cause?: Error;
}> => {
  // the last host's own reason, and whether it was a 400 that may name the request
  const faultReasonLast = asHostFaultReason({ error: input.faultLast });
  const isRequestNamed =
    faultReasonLast !== null &&
    asHostFault({ error: input.faultLast })?.outcome === 'failed';
  const fix = asFix({
    untried: input.untried,
    retryAfter: input.retryAfter,
    isRequestNamed,
  });

  // a stall names its bound, and the lever for a slow answer
  const stalls = getOneStallCount({ attempts: input.attempts });
  const fixStall =
    stalls > 0
      ? [
          `a stalled host sent no whole reply inside ${asDurationInWords(input.bound)}. the bound ends a dead host;`,
          'if answers are slow rather than dead, cap thought (effort on the ask), never a longer bound.',
        ]
      : [];
  const headline =
    input.untried > 0
      ? `openrouter served no qualified endpoint of ${input.model}: the walk stopped after ${stalls} stalled hosts, with ${input.untried} untried. no answer was returned.`
      : `openrouter served no qualified endpoint of ${input.model}: each was ${asFaultPhraseList()}. no answer was returned.`;

  return new MalfunctionError(
    [
      headline,
      '',
      ...input.attempts.map(
        (attempt) =>
          `  ${attempt.outcome.padEnd(OUTCOME_COLUMN)} ${attempt.tag}`,
      ),
      '',
      ...(faultReasonLast ? [`last host fault: ${faultReasonLast}`, ''] : []),
      fix,
      ...fixStall,
    ].join('\n'),
    {
      model: input.model,
      attempts: input.attempts,
      retryAfter: input.retryAfter,
      faultReasonLast,
      untried: input.untried,
      bound: input.bound,
      ...(input.faultLast ? { cause: input.faultLast } : {}),
    },
  );
};
