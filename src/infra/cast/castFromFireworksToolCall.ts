import type OpenAI from 'openai';
import type { BrainPlugToolInvocation } from 'rhachet/brains';

/**
 * .what = converts a fireworks ai / openai tool call to rhachet invocation
 * .why = enables callers to receive typed tool invocations from the brain
 *
 * .note = fireworks ai uses openai's tool_calls format:
 *   - id: string (maps to exid)
 *   - function.name: string (maps to slug)
 *   - function.arguments: JSON string (parsed to input)
 */
export const castFromFireworksToolCall = (input: {
  toolCall: OpenAI.ChatCompletionMessageToolCall;
}): BrainPlugToolInvocation => {
  // parse arguments from JSON string
  const parsedInput = JSON.parse(input.toolCall.function.arguments);

  return {
    exid: input.toolCall.id,
    slug: input.toolCall.function.name,
    input: parsedInput,
  };
};
