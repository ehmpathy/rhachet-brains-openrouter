/**
 * .what = how many endpoints survived each promise, in the order applied
 * .why = names the promise that emptied the set, or the toll each one took
 */
export type SupplyFunnel = { promise: string; left: number }[];
