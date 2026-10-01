import { createHash } from 'node:crypto';

/**
 * .what = prefix for every affinity key this package emits
 * .why = makes our traffic legible in fireworks routing diagnostics
 */
const KEY_PREFIX = 'rhachet-fireworks';

/**
 * .what = how many hex chars of the digest the key carries
 * .why = 32 hex chars = 128 bits; far past collision reach, still a short header
 */
const KEY_DIGEST_LENGTH = 32;

/**
 * .what = derives the replica-affinity key for a fireworks request, from the
 *         prompt prefix that request shares with its peers
 * .why = fireworks holds the prompt cache on the replica that served a request.
 *        serverless hands each call to an arbitrary replica, so a repeated
 *        prefix lands on a replica that never saw it and the cache never hits.
 *        a key that names the SHARED PREFIX routes those calls to one replica.
 *
 * .note = the key names what requests SHARE, never what makes them unique.
 *         a per-request or per-turn id pins perfectly and shares none of the
 *         prefix: every call earns its own replica and the hit rate stays at
 *         zero while the header looks correct. so the key is derived from the
 *         system prompt — the one part of the request that repeats across
 *         prompts and across episodes.
 *
 * .note = the key stays coarse on purpose. it excludes tool definitions, the
 *         episode, and the prompt, all of which sit behind the system prompt in
 *         the message order. a finer key would split callers that share the
 *         system prefix onto separate replicas, and a replica caches many
 *         prefixes at once — so over-fragmentation costs more than it buys.
 *
 * .note = returns null when there is no system prompt. with no briefs there is
 *         no prefix worth sharing, and a single constant key would funnel every
 *         brief-less call of a model onto one replica for no cache gain.
 *
 * .sources
 *   - https://docs.fireworks.ai/guides/prompt-caching
 *     "Prompt caching only works within 1 replica. If you are using serverless
 *      or a deployment with multiple replicas, you need to give us hints for
 *      where to send the traffic to maximize prompt cache hit rates."
 */
export const getOnePromptCacheAffinityKey = (input: {
  model: string;
  systemPrompt: string | undefined;
}): string | null => {
  // absent system prompt => no shared prefix => no pin worth sending
  if (!input.systemPrompt) return null;

  // digest the prefix, so the key is stable, short, and carries no brief content
  const digest = createHash('sha256')
    .update(input.model)
    .update('\u0000') // separator; keeps model+prompt from concatenating ambiguously
    .update(input.systemPrompt)
    .digest('hex')
    .slice(0, KEY_DIGEST_LENGTH);

  return `${KEY_PREFIX}-${digest}`;
};
