import {
  isSimpleCacheConditionError,
  type SimpleOnDiskCache,
} from 'simple-on-disk-cache';

/**
 * .what = claims the one background zdr refresh across every process on this machine
 * .why = an in-memory dedupe holds one read per PROCESS. a fleet of fresh
 *        processes (each `rhx review` is one) that all find the index stale would
 *        each read the ~1.17MB list. a put-if-absent on a short-lived disk key lets
 *        exactly one win; the rest keep the stale index and skip the read
 *
 * .note = the claim expires on its own, so a refresh that fails, or a process
 *         that dies mid-read, frees it for the next stale ask
 * .note = the put-if-absent arbitrates on the physical disk entry, so two
 *         processes that race cannot both win
 */
export const genZdrRefreshClaim = async (
  input: { key: string; minutes: number },
  context: { cache: SimpleOnDiskCache },
): Promise<{ won: boolean }> => {
  try {
    await context.cache.set(input.key, String(Date.now()), {
      expiration: { minutes: input.minutes },
      condition: { version: null },
    });
    return { won: true };
  } catch (error) {
    // another process holds the claim; only that precondition miss is expected
    if (isSimpleCacheConditionError(error)) return { won: false };
    throw error;
  }
};
