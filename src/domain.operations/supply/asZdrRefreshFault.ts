import { MalfunctionError } from 'helpful-errors';

/**
 * .what = what a fault in the background zdr refresh becomes
 * .why = the refresh runs behind an ask no caller awaits, so a fault there has
 *        no caller to throw to. the two faults are not alike:
 *        - a failed read (a MalfunctionError from the live read) is expected:
 *          the stale index still serves, and the next stale ask retries. a warn
 *        - any other fault is a defect in this package. it is held, and thrown
 *          by the next ask a caller awaits — loud, at a seam a caller observes,
 *          never an unhandled rejection that halts the host (F25)
 */
export const asZdrRefreshFault = (input: {
  error: unknown;
  ageMinutes: number;
}):
  | { warn: string; defect: null }
  | {
      warn: null;
      defect: MalfunctionError<{ cause: Error; ageMinutes: number }>;
    } => {
  // a failed read: the stale index still serves, the next stale ask retries
  if (input.error instanceof MalfunctionError)
    return {
      warn: `💥 MalfunctionError: openrouter zdr refresh failed; the cached index (age ${input.ageMinutes} min) still serves. a later ask retries. cause: ${input.error.message}`,
      defect: null,
    };

  // any other fault is a defect: hold it for the next awaited ask to throw
  return {
    warn: null,
    defect: new MalfunctionError(
      'a defect in the background openrouter zdr refresh. report this to rhachet-brains-openrouter.',
      {
        cause:
          input.error instanceof Error
            ? input.error
            : new Error(String(input.error)),
        ageMinutes: input.ageMinutes,
      },
    ),
  };
};
