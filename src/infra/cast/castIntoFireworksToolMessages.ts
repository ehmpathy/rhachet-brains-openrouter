import type OpenAI from 'openai';
import type { BrainPlugToolExecution } from 'rhachet/brains';

/**
 * .what = converts rhachet tool executions to fireworks ai / openai tool messages
 * .why = enables tool result continuation in the brain conversation
 *
 * .note = fireworks ai uses openai's tool message format:
 *   - role: 'tool'
 *   - tool_call_id: string (from execution.exid)
 *   - content: string (JSON stringified output or error)
 */
export const castIntoFireworksToolMessages = (input: {
  executions: BrainPlugToolExecution[];
}): OpenAI.ChatCompletionToolMessageParam[] => {
  return input.executions.map((execution) => {
    // format content based on signal
    const content =
      execution.signal === 'success'
        ? JSON.stringify(execution.output)
        : JSON.stringify({
            error: execution.output.error.message,
            signal: execution.signal,
          });

    return {
      role: 'tool' as const,
      tool_call_id: execution.exid,
      content,
    };
  });
};
