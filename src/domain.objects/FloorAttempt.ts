import type { HostFault } from './HostFault';

/**
 * .what = one hop of the floor walk, and how it ended
 * .why = the caller audits the walk: which admits were tried, in what order, and why
 *        each was left. the admitted set reports its hops in the same shape
 *
 * .note = served = the host answered; each other outcome is a `HostFault`, named there
 */
export type FloorAttempt = {
  tag: string;
  outcome: 'served' | HostFault;
};
