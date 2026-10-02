import { MalfunctionError } from 'helpful-errors';
import { z } from 'zod';

import { isStringLikeJsonSchema } from './isStringLikeJsonSchema';

/**
 * .what = parses api response content based on schema type
 * .why = object schemas need JSON.parse; string schemas take content directly
 *
 * .note = string schemas (plain or nullable) receive plain text from api
 *         because vllm constraint requires z.string() for tool use output
 */
export const asOutputFromContent = <T>(input: {
  content: string;
  schema: z.Schema<T>;
}): T => {
  // string-like schemas: parse content directly (no JSON.parse)
  const jsonSchema = z.toJSONSchema(input.schema);
  if (isStringLikeJsonSchema({ jsonSchema })) {
    return input.schema.parse(input.content);
  }

  // object/array schemas: JSON parse first
  return input.schema.parse(asJsonFromContent({ content: input.content }));
};

/**
 * .what = the reply content, parsed as json
 * .why = a bare `SyntaxError` names neither the reply nor its size; a reply that is
 *        not json must say so, with enough of the reply to see why
 *
 * .note = only a SyntaxError is caught; every other error rethrows untouched
 */
const asJsonFromContent = (input: { content: string }): unknown => {
  try {
    return JSON.parse(input.content);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new MalfunctionError(
      `the reply is not valid json (${error.message}), though a json schema was asked for`,
      {
        contentLength: input.content.length,
        contentHead: input.content.slice(0, 200),
        contentTail: input.content.slice(-200),
        cause: error,
      },
    );
  }
};
