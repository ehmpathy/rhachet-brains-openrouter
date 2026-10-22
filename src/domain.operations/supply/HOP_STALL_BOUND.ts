import type { IsoDuration } from 'iso-time';

/**
 * .what = the bound one call to openrouter may take, body included
 * .why = it ends a dead host, never a slow answer; a slow answer is bounded by a
 *        thought cap. measured 2026-10-21: three review asks hung 21 minutes
 *        on one flash host with no reply, while the same ids answered live in 12s
 */
export const HOP_STALL_BOUND: IsoDuration = { minutes: 10 };
