/**
 * .what = the thought tokens an openai-compatible response reports, or null
 * .why = openrouter reports them at `usage.completion_tokens_details.reasoning_tokens`,
 *        carved out of `completion_tokens`. a host that reports none reads as null,
 *        never a fake 0, so a caller sizes its budget from real data only
 */
export const asTokensThought = (input: {
  usage:
    | {
        completion_tokens_details?: { reasoning_tokens?: number | null } | null;
      }
    | null
    | undefined;
}): number | null => {
  const tokens = input.usage?.completion_tokens_details?.reasoning_tokens;
  return typeof tokens === 'number' ? tokens : null;
};
