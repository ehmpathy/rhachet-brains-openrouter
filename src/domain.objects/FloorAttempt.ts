/**
 * .what = one hop of the floor walk, and how it ended
 * .why = the caller audits the walk: which admits were tried, in what order, and why
 *        each was left
 *
 * .note = throttled = a 429; refused = a 404, openrouter could not reach the admitted endpoint;
 *         failed = the host answered 200 and failed mid-reply (`isReplyFailed`);
 *         prose = the host answered prose where a json schema was owed
 *         (`isReplyJsonIgnored`), and is skipped by json asks for 7 days
 */
export type FloorAttempt = {
  tag: string;
  outcome: 'served' | 'throttled' | 'refused' | 'failed' | 'prose';
};
