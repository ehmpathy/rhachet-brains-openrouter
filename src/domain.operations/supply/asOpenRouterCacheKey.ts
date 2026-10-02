import { castToSafeOnDiskCacheKey } from 'simple-on-disk-cache';

/**
 * .what = a safe cache key from a read name and the model it is for
 * .why = 🔴 the default key is the serialized input, which holds the api key;
 *        that key must never land in a file name on disk. so key on the read's
 *        identity alone
 */
export const asOpenRouterCacheKey = (input: {
  read: string;
  model: string | null;
}): string =>
  castToSafeOnDiskCacheKey({
    procedure: { name: `openrouter.${input.read}`, version: '1' },
    execution: { input: { model: input.model } },
  });
