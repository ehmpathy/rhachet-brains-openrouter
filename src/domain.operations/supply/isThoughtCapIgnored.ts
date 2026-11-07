// how far past its budget a host may think before the cap reads as ignored
const THOUGHT_BUDGET_HONOR_SLACK = 1.5;

/**
 * .what = whether a host thought far past the budget it was sent
 * .why = a host can list `reasoning` and not honor a budget (measured 2026-10-21: z-ai
 *        flash's host thought 875–1218 whatever the budget). the all-thought fix names
 *        such a host rather than a lower budget, and the live probe reads the same rule
 *
 * .note = a slack, since a host that honors the cap may still overrun it a little
 */
export const isThoughtCapIgnored = (input: {
  tokensThought: number | null;
  tokensThoughtBudget: number | null;
}): boolean =>
  input.tokensThought !== null &&
  input.tokensThoughtBudget !== null &&
  input.tokensThought > input.tokensThoughtBudget * THOUGHT_BUDGET_HONOR_SLACK;
