import type { BrainPlugToolExecution } from 'rhachet/brains';

/**
 * .what = an ask's prompt, as the text the exchange record holds
 * .why = a prompt is either the caller's words or the tool executions a
 *        continuation answers; both are recorded, and measured, as text
 */
export const asPromptText = (input: {
  prompt: string | BrainPlugToolExecution[];
}): string =>
  typeof input.prompt === 'string'
    ? input.prompt
    : JSON.stringify(input.prompt);
