import type OpenAI from 'openai';
import type { BrainPlugToolDefinition } from 'rhachet/brains';
import { z } from 'zod';

import { asOpenRouterToolName } from './asOpenRouterToolName';

/**
 * .what = converts a rhachet tool definition to openrouter / openai format
 * .why = enables tool use via openrouter's openai-compatible api
 *
 * .note = openrouter uses openai's function call format:
 *   - type: 'function'
 *   - function: { name, description, parameters, strict }
 * .note = the name is the slug cast to the function-name charset
 *         (`asOpenRouterToolName`); a dot in a slug is refused by strict hosts
 */
export const asOpenRouterToolDef = (input: {
  tool: BrainPlugToolDefinition;
}): OpenAI.ChatCompletionTool => {
  // convert zod schema to json schema for function parameters
  const parametersSchema = z.toJSONSchema(input.tool.schema.input);

  return {
    type: 'function',
    function: {
      name: asOpenRouterToolName({ slug: input.tool.slug }),
      description: input.tool.description,
      parameters: parametersSchema,
      strict: true,
    },
  };
};
