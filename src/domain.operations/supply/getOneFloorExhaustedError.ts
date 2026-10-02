import { MalfunctionError } from 'helpful-errors';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';

/**
 * .what = the error for a floor walk that tried every qualified endpoint
 * .why = the caller sees each hop and its outcome, and the wait openrouter
 *        asked for, so the fix is a retry by the server's clock (case=14)
 */
export const getOneFloorExhaustedError = (input: {
  model: string;
  attempts: FloorAttempt[];
  retryAfter: string | null;
}): MalfunctionError<{
  model: string;
  attempts: FloorAttempt[];
  retryAfter: string | null;
}> => {
  const fix = input.retryAfter
    ? `fix: retry after ${input.retryAfter}s (openrouter's retry-after), or loosen a promise so more endpoints qualify.`
    : 'fix: retry later, or loosen a promise so more endpoints qualify.';
  return new MalfunctionError(
    [
      `openrouter served no qualified endpoint of ${input.model}: each was rate limited, refused, failed mid-reply, or answered prose where json was owed. no answer was returned.`,
      '',
      ...input.attempts.map(
        (attempt) => `  ${attempt.outcome.padEnd(9)} ${attempt.tag}`,
      ),
      '',
      fix,
    ].join('\n'),
    {
      model: input.model,
      attempts: input.attempts,
      retryAfter: input.retryAfter,
    },
  );
};
