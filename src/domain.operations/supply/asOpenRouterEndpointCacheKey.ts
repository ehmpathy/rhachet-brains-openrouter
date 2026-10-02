import { castToSafeOnDiskCacheKey } from 'simple-on-disk-cache';

/**
 * .what = a safe cache key for one fact about one endpoint of one model
 * .why = a fact a host earns (e.g. it ignored a json schema) belongs to that
 *        host on that model alone; one key per pair lets each entry expire on
 *        its own clock, and a write never races a read of its peers
 *
 * .note = 🔴 keyed on identity alone, never the api key (asOpenRouterCacheKey)
 */
export const asOpenRouterEndpointCacheKey = (input: {
  read: string;
  model: string;
  tag: string;
}): string =>
  castToSafeOnDiskCacheKey({
    procedure: { name: `openrouter.${input.read}`, version: '1' },
    execution: { input: { model: input.model, tag: input.tag } },
  });
