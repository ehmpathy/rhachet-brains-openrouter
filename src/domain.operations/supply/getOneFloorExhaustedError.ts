import { MalfunctionError } from 'helpful-errors';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import { asHostFault } from './asHostFault';
import { asHostFaultReason } from './asHostFaultReason';

/**
 * .what = the error for a supply that tried every qualified endpoint — the floor
 *         walk, or the admitted set once each host faulted
 * .why = the caller sees each hop and its outcome, the wait openrouter asked
 *        for, and the last host's own reason, so the fix is a retry by the
 *        server's clock (case=14) — or a fix to the request, when the last host
 *        rejected the request itself (a prompt over the context window)
 *
 * .note = the last host's error rides as `cause`, so its status, headers, and
 *         body stay readable; the message names the class a caller branches on
 * .note = the request is named in the fix only after a host 400 (`failed`): a
 *         throttle or a refusal never blames the request
 */
export const getOneFloorExhaustedError = (input: {
  model: string;
  attempts: FloorAttempt[];
  retryAfter: string | null;
  faultLast: Error | null; // the last host fault's own error
}): MalfunctionError<{
  model: string;
  attempts: FloorAttempt[];
  retryAfter: string | null;
  faultReasonLast: string | null;
  cause?: Error;
}> => {
  // the last host's own reason, and whether it was a 400 that may name the request
  const faultReasonLast = asHostFaultReason({ error: input.faultLast });
  const isRequestNamed =
    faultReasonLast !== null &&
    asHostFault({ error: input.faultLast })?.outcome === 'failed';

  // the fix: a retry by openrouter's clock, or a fix to the request first
  const retry = input.retryAfter
    ? `retry after ${input.retryAfter}s (openrouter's retry-after), or loosen a promise so more endpoints qualify.`
    : 'retry later, or loosen a promise so more endpoints qualify.';
  const fix = isRequestNamed
    ? `fix: if the last host fault names your request (e.g. a context limit), fix the request; else ${retry}`
    : `fix: ${retry}`;

  return new MalfunctionError(
    [
      `openrouter served no qualified endpoint of ${input.model}: each was rate limited, refused, failed (mid-reply or with its own error), or answered prose where json was owed. no answer was returned.`,
      '',
      ...input.attempts.map(
        (attempt) => `  ${attempt.outcome.padEnd(9)} ${attempt.tag}`,
      ),
      '',
      ...(faultReasonLast ? [`last host fault: ${faultReasonLast}`, ''] : []),
      fix,
    ].join('\n'),
    {
      model: input.model,
      attempts: input.attempts,
      retryAfter: input.retryAfter,
      faultReasonLast,
      ...(input.faultLast ? { cause: input.faultLast } : {}),
    },
  );
};
