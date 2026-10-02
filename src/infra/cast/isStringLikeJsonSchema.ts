import type { z } from 'zod';

/**
 * .what = whether a json schema asks for plain text: a string, or a nullable string
 * .why = one classifier for every side of an ask. the request (send
 *        `response_format` or not), the tools guard, and the reply parse must
 *        agree on what a nullable string is — else a nullable-string ask sends
 *        `response_format`, gets a json-quoted reply, and reads the quotes as text
 *
 * .note = `z.string().nullable()` emits `{ anyOf: [{ type: 'string' }, { type: 'null' }] }`,
 *         with no top-level `type`
 */
export const isStringLikeJsonSchema = (input: {
  jsonSchema: z.core.JSONSchema.BaseSchema;
}): boolean => {
  // a plain string
  if (input.jsonSchema.type === 'string') return true;

  // a nullable string: anyOf of exactly string and null
  const types = (input.jsonSchema.anyOf ?? []).map((member) =>
    typeof member === 'object' ? member.type : undefined,
  );
  return (
    types.length === 2 && types.includes('string') && types.includes('null')
  );
};
