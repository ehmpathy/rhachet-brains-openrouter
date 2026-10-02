import { ConstraintError } from 'helpful-errors';
import type OpenAI from 'openai';
import type { BrainPlugToolExecution } from 'rhachet/brains';

/**
 * .what = the error message of a failed tool execution
 * .why = the type promises `output.error: Error`, yet the execution comes from the
 *        caller's tool loop at runtime; a malformed one fails with a named error,
 *        never a bare TypeError from inside a cast
 */
const asToolErrorMessage = (input: {
  execution: Extract<BrainPlugToolExecution, { signal: `error:${string}` }>;
}): string => {
  const output: unknown = input.execution.output;
  const error: unknown =
    typeof output === 'object' && output !== null && 'error' in output
      ? output.error
      : null;
  if (error instanceof Error) return error.message;
  throw new ConstraintError(
    `tool execution '${input.execution.exid}' signaled '${input.execution.signal}' with no error in its output`,
    {
      exid: input.execution.exid,
      slug: input.execution.slug,
      hint: 'a failed execution must carry output: { error: new Error(...) }',
    },
  );
};

/**
 * .what = converts rhachet tool executions to openrouter / openai tool messages
 * .why = enables tool result continuation in the brain conversation
 *
 * .note = openrouter uses openai's tool message format:
 *   - role: 'tool'
 *   - tool_call_id: string (from execution.exid)
 *   - content: string (JSON stringified output or error)
 */
export const asOpenRouterToolMessages = (input: {
  executions: BrainPlugToolExecution[];
}): OpenAI.ChatCompletionToolMessageParam[] => {
  return input.executions.map((execution) => {
    // format content based on signal
    const content =
      execution.signal === 'success'
        ? JSON.stringify(execution.output)
        : JSON.stringify({
            error: asToolErrorMessage({ execution }),
            signal: execution.signal,
          });

    return {
      role: 'tool' as const,
      tool_call_id: execution.exid,
      content,
    };
  });
};
