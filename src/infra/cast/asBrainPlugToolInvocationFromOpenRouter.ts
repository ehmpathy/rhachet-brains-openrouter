import { MalfunctionError } from 'helpful-errors';
import type OpenAI from 'openai';
import type { BrainPlugToolInvocation } from 'rhachet/brains';

/**
 * .what = converts an openrouter / openai tool call to rhachet invocation
 * .why = enables callers to receive typed tool invocations from the brain
 *
 * .note = openrouter uses openai's tool_calls format:
 *   - id: string (maps to exid)
 *   - function.name: string (maps back to the plugged slug, via `slugByName`)
 *   - function.arguments: JSON string (parsed to input)
 *
 * .note = a name no plugged tool sends under is kept verbatim, so the caller's
 *         tool loop sees exactly what the model asked for
 */
export const asBrainPlugToolInvocationFromOpenRouter = (input: {
  toolCall: OpenAI.ChatCompletionMessageToolCall;
  slugByName: Record<string, string>;
}): BrainPlugToolInvocation => ({
  exid: input.toolCall.id,
  slug:
    input.slugByName[input.toolCall.function.name] ??
    input.toolCall.function.name,
  input: asToolArgumentsFromJson({ toolCall: input.toolCall }),
});

/**
 * .what = the tool call's arguments, parsed from json
 * .why = the model writes the arguments; an open-weight host can emit empty,
 *        cut, or malformed json. a bare SyntaxError names neither the call nor
 *        the tool, so the failure names both, with the head of what was sent
 *
 * .note = only a SyntaxError is caught; every other error rethrows untouched
 */
const asToolArgumentsFromJson = (input: {
  toolCall: OpenAI.ChatCompletionMessageToolCall;
}): unknown => {
  try {
    return JSON.parse(input.toolCall.function.arguments);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new MalfunctionError(
      `the model asked for tool '${input.toolCall.function.name}' with arguments that are not valid json (${error.message}). no tool was run.`,
      {
        exid: input.toolCall.id,
        slug: input.toolCall.function.name,
        argumentsLength: input.toolCall.function.arguments.length,
        argumentsHead: input.toolCall.function.arguments.slice(0, 200),
        cause: error,
      },
    );
  }
};
