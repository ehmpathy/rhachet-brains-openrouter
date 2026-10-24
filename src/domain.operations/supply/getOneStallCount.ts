import type { FloorAttempt } from '../../domain.objects/FloorAttempt';

/**
 * .what = how many hops of a floor walk stalled
 * .why = each stall costs a full per-hop bound, so the walk stops after a few, and
 *        its exhausted error names how many it waited out
 */
export const getOneStallCount = (input: { attempts: FloorAttempt[] }): number =>
  input.attempts.filter((attempt) => attempt.outcome === 'stalled').length;
