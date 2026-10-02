import type { MalfunctionError } from 'helpful-errors';

import { asOpenRouterCacheKey } from './asOpenRouterCacheKey';
import { asZdrCacheEntryOrMiss } from './asZdrCacheEntryOrMiss';
import { asZdrRefreshFault } from './asZdrRefreshFault';
import { asZdrTagsByModel } from './asZdrTagsByModel';
import { cacheOpenRouterOnDisk } from './cacheOpenRouterOnDisk';
import { genZdrRefreshClaim } from './genZdrRefreshClaim';
import { getOneOpenRouterJson } from './getOneOpenRouterJson';

/**
 * .what = the zero-retention endpoint tags of each model
 * .why = the full zdr list is ~1.17MB across ~925 rows; this slim index is what
 *        a privacy check reads, so a warm read parses kilobytes, not megabytes
 */
type ZdrTagsByModel = Record<string, string[]>;

/**
 * .what = how long a zdr index is fresh, and how long a stale one may still serve
 * .why = stale-while-revalidate. a stale index is safe to serve: every
 *        privacy=full call also sends `zdr: true`, so openrouter itself refuses
 *        an endpoint that left the zdr list — a stale yes costs one walk hop,
 *        never a retention breach. the max bounds that cost
 */
const ZDR_FRESH_MS = 60 * 60 * 1000;
const ZDR_SERVABLE_HOURS = 24;
const ZDR_CACHE_KEY = asOpenRouterCacheKey({ read: 'zdr', model: null });

/**
 * .what = the disk key and lifetime of the claim on a background zdr refresh
 * .why = one machine-wide refresh per window; the claim outlives a slow read,
 *        and frees itself if its holder dies
 */
const ZDR_REFRESH_CLAIM_KEY = asOpenRouterCacheKey({
  read: 'zdr.refresh.claim',
  model: null,
});
const ZDR_REFRESH_CLAIM_MINUTES = 5;

/**
 * .what = one zdr refresh in flight per process
 * .why = a fleet of asks that all find the index stale starts one read, not many
 *
 * .note = keyed by ZDR_CACHE_KEY alone: the zdr list is one global read, the
 *         same for every api key, so one key holds at most one entry
 * .note = this dedupes within a process; across processes, the disk claim does
 */
const zdrRefreshInFlight = new Map<
  string,
  Promise<{ at: number; index: ZdrTagsByModel }>
>();

/**
 * .what = a defect the background refresh hit, held for the next awaited ask
 * .why = the refresh has no caller to throw to; the next ask does (F25)
 *
 * .note = keyed by ZDR_CACHE_KEY alone, as the in-flight map is
 */
const zdrRefreshDefectHeld = new Map<
  string,
  MalfunctionError<{ cause: Error; ageMinutes: number }>
>();

/**
 * .what = reads the full zdr list live, slims it, and writes it to disk
 * .why = the one place the ~1.17MB list is fetched; deduped per process
 */
const setZdrIndexFromLive = (input: {
  apiKey: string;
}): Promise<{ at: number; index: ZdrTagsByModel }> => {
  const found = zdrRefreshInFlight.get(ZDR_CACHE_KEY);
  if (found) return found;
  const refresh = (async () => {
    const entry = {
      at: Date.now(),
      index: asZdrTagsByModel({
        body: await getOneOpenRouterJson({
          path: '/endpoints/zdr',
          apiKey: input.apiKey,
        }),
      }),
    };
    await cacheOpenRouterOnDisk.set(ZDR_CACHE_KEY, JSON.stringify(entry), {
      expiration: { hours: ZDR_SERVABLE_HOURS },
    });
    return entry;
  })().finally(() => zdrRefreshInFlight.delete(ZDR_CACHE_KEY));
  zdrRefreshInFlight.set(ZDR_CACHE_KEY, refresh);
  return refresh;
};

/**
 * .what = refreshes the zdr index behind an ask that was already served
 * .why = a stale index serves now; one process on this machine refreshes it
 *
 * .note = never throws here: no caller awaits it, so a throw would surface only
 *         as an unhandled rejection that can halt the host — a crash charged to
 *         an ask that already succeeded. instead (asZdrRefreshFault, F25):
 *         - a failed read warns; the stale index still serves, a later ask retries
 *         - any other fault is a defect, held and thrown by the next awaited ask
 */
const setZdrIndexBehind = async (input: {
  apiKey: string;
  ageMinutes: number;
}): Promise<void> => {
  try {
    // only the one process that wins the claim reads the ~1.17MB list
    const claim = await genZdrRefreshClaim(
      { key: ZDR_REFRESH_CLAIM_KEY, minutes: ZDR_REFRESH_CLAIM_MINUTES },
      { cache: cacheOpenRouterOnDisk },
    );
    if (!claim.won) return;
    await setZdrIndexFromLive({ apiKey: input.apiKey });
  } catch (error) {
    // a failed read warns; a defect is held for the next awaited ask to throw
    const fault = asZdrRefreshFault({ error, ageMinutes: input.ageMinutes });
    if (fault.defect === null) return console.warn(fault.warn);
    zdrRefreshDefectHeld.set(ZDR_CACHE_KEY, fault.defect);
  }
};

/**
 * .what = the zero-retention index for every model, stale-while-revalidate
 * .why = openrouter serves no per-model zdr read (probed 2026-10-02: every
 *        query form 404s or is ignored), so the ~1.17MB list is kept slim on
 *        disk and refreshed behind the ask, never in front of it
 *
 * .note = fresh (< 60 min) → serve. stale (< 24h) → serve, and refresh behind.
 *         absent, corrupt, wrong in shape, or past 24h → read live, and wait for it
 * .note = the background refresh never throws; a defect it held is thrown here,
 *         by the next call (setZdrIndexBehind, F25)
 */
export const getAllZdrTagsByModel = async (input: {
  apiKey: string;
}): Promise<ZdrTagsByModel> => {
  // a defect the background refresh held surfaces here, once, where a caller awaits
  const defect = zdrRefreshDefectHeld.get(ZDR_CACHE_KEY);
  zdrRefreshDefectHeld.delete(ZDR_CACHE_KEY);
  if (defect) throw defect;

  // absent, corrupt, wrong in shape, or past the servable bound: wait for a live read
  const cached = await cacheOpenRouterOnDisk.get(ZDR_CACHE_KEY);
  const entry = cached ? asZdrCacheEntryOrMiss({ cached }) : null;
  if (!entry) return (await setZdrIndexFromLive(input)).index;

  // stale but servable: serve now, refresh behind
  const ageMs = Date.now() - entry.at;
  if (ageMs >= ZDR_FRESH_MS)
    void setZdrIndexBehind({
      apiKey: input.apiKey,
      ageMinutes: Math.round(ageMs / 60000),
    });
  return entry.index;
};
