/**
 * .what = what an ask needs of the endpoint that serves it
 * .why = a json reply needs `response_format` and `structured_outputs`; tools
 *        need `tools`. the supply filters keep only endpoints that honor each need
 *
 * .note = the ask sends a strict `json_schema`. `response_format` alone marks
 *         only json mode; `structured_outputs` marks the schema itself (probed
 *         2026-10-02: 5 of 34 hosts of z-ai/glm-5.3-flash list the first alone)
 *
 * .note = a string-like schema (plain or nullable string) needs no constraint,
 *         so it neither sends `response_format` nor requires an endpoint that
 *         supports it (F21). `isStringLikeJsonSchema` decides, the same
 *         classifier the reply parse uses, so the two sides cannot disagree
 * .note = upstream vllm-based providers reject "response format and function
 *         call at the same time", so an ask with tools never asks for json
 */
export const asAskNeeds = (input: {
  hasTools: boolean;
  isStringLike: boolean;
}): { structuredOutput: boolean; paramsRequired: string[] } => {
  const structuredOutput = !input.hasTools && !input.isStringLike;
  return {
    structuredOutput,
    paramsRequired: [
      ...(input.hasTools ? ['tools'] : []),
      ...(structuredOutput ? ['response_format', 'structured_outputs'] : []),
    ],
  };
};
