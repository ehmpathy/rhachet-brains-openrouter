import { z } from 'zod';

/**
 * .what = parses api response content based on schema type
 * .why = object schemas need JSON.parse; string schemas take content directly
 *
 * .note = string schemas (plain or nullable) receive plain text from api
 *         because vllm constraint requires z.string() for tool use output
 */
export const castContentToOutputSchema = <T>(input: {
  content: string;
  schema: z.Schema<T>;
}): T => {
  const jsonSchema = z.toJSONSchema(input.schema) as {
    type?: string;
    anyOf?: Array<{ type?: string }>;
  };

  // detect string-like schemas: plain string or nullable string (anyOf with string + null)
  const isStringSchema = (() => {
    if (jsonSchema.type === 'string') return true;
    if (jsonSchema.anyOf) {
      const types = jsonSchema.anyOf.map((s) => s.type).filter(Boolean);
      // nullable string: anyOf with string and null only
      return (
        types.length === 2 && types.includes('string') && types.includes('null')
      );
    }
    return false;
  })();

  // string schemas: parse content directly (no JSON.parse)
  if (isStringSchema) {
    return input.schema.parse(input.content);
  }

  // object/array schemas: JSON parse first
  return input.schema.parse(JSON.parse(input.content));
};
