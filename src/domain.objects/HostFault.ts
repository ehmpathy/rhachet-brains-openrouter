import type { HostFaultTransport } from './HostFaultError';

/**
 * .what = every way one host can fail an ask: the outcomes a supply path steps past
 * .why = one name for "this host did not serve", so the walk, the admitted set, the
 *        cache proofs, and the refusal all read one closed set
 *
 * .note = throttled = a 429; refused = a 404, openrouter could not reach the host;
 *         failed = the host failed this ask: a 200 that failed mid-reply (`isReplyFailed`),
 *         its own 400 (marked by openrouter), or a 502/503/504;
 *         prose = the host answered prose where a json schema was owed (`isReplyJsonIgnored`);
 *         empty = the host ended a json ask with no content (`isReplyEmptyWhereJsonOwed`);
 *         body-cut, stalled = the transport faults (`HostFaultError`)
 */
export type HostFault =
  | 'throttled'
  | 'refused'
  | 'failed'
  | 'prose'
  | 'empty'
  | HostFaultTransport;
