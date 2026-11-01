/**
 * .what = whether a reply's text parses as json
 * .why = a host can list `response_format` and still answer in prose (measured
 *        2026-10-02: Phala, on z-ai/glm-5.3-flash, 4 of 6 asks). the walk and the
 *        defect error both read this one rule, so the two never drift
 *
 * .note = only a SyntaxError reads as not-json; every other error rethrows
 */
export const isJsonText = (input: { content: string }): boolean => {
  try {
    JSON.parse(input.content);
    return true;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return false;
  }
};
