import type { OpenRouterReasoning } from '../../domain.objects/OpenRouterReasoning';

/**
 * .what = the thought level an ask set; null where it set none, or set a budget
 * .why = the all-thought error names a lower level to a caller who set one (case=2),
 *        apart from the budget it names to a caller who set none
 */
export const asThoughtLevel = (input: {
  reasoning: OpenRouterReasoning | null;
}): string | null =>
  input.reasoning !== null && 'effort' in input.reasoning
    ? input.reasoning.effort
    : null;
