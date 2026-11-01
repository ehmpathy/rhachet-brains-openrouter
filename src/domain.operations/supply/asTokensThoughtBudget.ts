import type { OpenRouterReasoning } from '../../domain.objects/OpenRouterReasoning';

/**
 * .what = the thought budget an ask set, in tokens; null where it set none, or set a level
 * .why = the funnel drops hosts whose output limit the budget would fill (q6), and the
 *        all-thought error names the budget to lower; both read one number
 */
export const asTokensThoughtBudget = (input: {
  reasoning: OpenRouterReasoning | null;
}): number | null =>
  input.reasoning !== null && 'max_tokens' in input.reasoning
    ? input.reasoning.max_tokens
    : null;
