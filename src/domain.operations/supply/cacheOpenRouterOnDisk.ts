import os from 'os';
import path from 'path';
import { createCache, type SimpleOnDiskCache } from 'simple-on-disk-cache';

import { asCachedJsonOrMiss } from './asCachedJsonOrMiss';

/**
 * .what = the raw on-disk store, shared by every process on this machine
 * .why = a fleet of asks (each `rhx review` a fresh process) shares one read
 *        per ttl. memory-first: each entry is a pure function of openrouter's
 *        state, so any writer's value is as good as any other's
 */
const cacheRaw = createCache({
  directory: {
    local: {
      path: path.join(
        os.homedir(),
        '.rhachet/storage/repo=openrouter/role=any/cache',
      ),
    },
  },
  consistency: 'memory-first',
});

/**
 * .what = the openrouter read cache, where a corrupt entry reads as a miss
 * .why = every read through it (endpoints, catalog, zdr index) gets the same
 *        guard at one seam: a truncated file costs one live read, never a
 *        SyntaxError on every ask until it expires
 */
export const cacheOpenRouterOnDisk: SimpleOnDiskCache = {
  ...cacheRaw,
  get: async (key, options) =>
    asCachedJsonOrMiss({ value: await cacheRaw.get(key, options) }),
};
