import type OpenAI from 'openai';
import type { BrainPlugToolExecution } from 'rhachet/brains';

/**
 * .what = the assistant message that requested the given tool executions
 * .why = openrouter / openai expect the assistant's tool_calls message before
 *        the tool result messages; a continuation rebuilds it from the executions
 */
export const asOpenRouterToolCallMessage = (input: {
  executions: BrainPlugToolExecution[];
}): OpenAI.ChatCompletionAssistantMessageParam => ({
  role: 'assistant',
  content: null,
  tool_calls: input.executions.map((execution) => ({
    id: execution.exid,
    type: 'function' as const,
    function: {
      name: execution.slug,
      arguments: JSON.stringify(execution.input),
    },
  })),
});
