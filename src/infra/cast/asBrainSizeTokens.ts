/**
 * .what = the token counts an openai-compatible response reports
 * .why = fireworks returns these under `usage`, with the cached count nested a
 *        level deeper and absent on older responses. naming the shape here
 *        keeps that quirk out of the orchestrator.
 */
type UsageOpenAiCompatible =
  | {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    }
  | undefined;

/**
 * .what = casts an openai-compatible `usage` into rhachet's disjoint token counts
 * .why = the two contracts disagree on whether the counts overlap, and the
 *        disagreement is worth real money.
 *
 *        fireworks is openai-compatible, so `prompt_tokens` is the TOTAL prompt
 *        and `cached_tokens` is a SUBSET of it. rhachet's calcBrainOutputCost
 *        sums input + cache.get as DISJOINT addends. hand it the raw
 *        `prompt_tokens` and every cached token is billed twice: once at the
 *        full input rate, once at the cache rate.
 *
 * .note = anthropic reports these disjointly already; that is why its adapter
 *         needs no subtraction and this one does.
 *
 * .note = input is clamped at 0, so a provider inconsistency cannot yield a
 *         negative token count, and thus a negative price.
 *
 * .note = `cache.set` is always 0. fireworks publishes no cache-write rate and
 *         returns no write count — a prompt cache fills as a side effect of the
 *         read path, so no write is billable.
 */
export const asBrainSizeTokens = (input: {
  usage: UsageOpenAiCompatible;
}): {
  input: number;
  output: number;
  cache: { get: number; set: number };
} => {
  const tokensPrompt = input.usage?.prompt_tokens ?? 0;
  const tokensOutput = input.usage?.completion_tokens ?? 0;
  const tokensCached = input.usage?.prompt_tokens_details?.cached_tokens ?? 0;

  return {
    input: Math.max(tokensPrompt - tokensCached, 0),
    output: tokensOutput,
    cache: { get: tokensCached, set: 0 },
  };
};
