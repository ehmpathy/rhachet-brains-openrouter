/**
 * .what = a cached value, or a miss if it is not valid json
 * .why = every value this package caches is json. a file truncated by a killed
 *        process or a disk fault must read as a miss — one live read — never as
 *        a bare SyntaxError on every ask until the entry expires
 */
export const asCachedJsonOrMiss = (input: {
  value: string | undefined;
}): string | undefined => {
  // an absent value is already a miss
  if (input.value === undefined) return undefined;

  // a value that does not parse is a corrupt entry: read it as a miss
  try {
    JSON.parse(input.value);
    return input.value;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return undefined;
  }
};
