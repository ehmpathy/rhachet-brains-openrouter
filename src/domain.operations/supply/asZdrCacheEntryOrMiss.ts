import { z } from 'zod';

/**
 * .what = the shape a zdr index entry holds on disk
 * .why = an entry written by another release, or by hand, may parse as json and
 *        still not be `{ at, index }`
 */
const SCHEMA_ZDR_CACHE_ENTRY = z.object({
  at: z.number(),
  index: z.record(z.string(), z.array(z.string())),
});

/**
 * .what = a cached zdr index entry, or a miss if its shape is not `{ at, index }`
 * .why = a value that parses yet holds the wrong shape must cost one live read,
 *        never a bare TypeError on every ask until the entry expires
 *
 * .note = the caller has already read the string through `cacheOpenRouterOnDisk`,
 *         so a value that does not parse never reaches here
 */
export const asZdrCacheEntryOrMiss = (input: {
  cached: string;
}): { at: number; index: Record<string, string[]> } | null => {
  const parsed = SCHEMA_ZDR_CACHE_ENTRY.safeParse(JSON.parse(input.cached));
  return parsed.success ? parsed.data : null;
};
