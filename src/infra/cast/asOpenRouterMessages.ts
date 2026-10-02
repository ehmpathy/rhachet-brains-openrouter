import type OpenAI from 'openai';
import type { BrainPlugToolExecution } from 'rhachet/brains';

import { asOpenRouterToolCallMessage } from './asOpenRouterToolCallMessage';
import { asOpenRouterToolMessages } from './asOpenRouterToolMessages';

/**
 * .what = the messages an ask sends, in order
 * .why = the system prompt, then each prior exchange, then this turn: a tool
 *        continuation (the assistant's tool_calls, then each result) or a
 *        plain user prompt
 */
export const asOpenRouterMessages = (input: {
  systemPrompt: string | null;
  exchanges: { input: string; output: string }[];
  prompt: string | BrainPlugToolExecution[];
}): OpenAI.ChatCompletionMessageParam[] => [
  ...(input.systemPrompt
    ? [{ role: 'system' as const, content: input.systemPrompt }]
    : []),
  ...input.exchanges.flatMap((exchange) => [
    { role: 'user' as const, content: exchange.input },
    { role: 'assistant' as const, content: exchange.output },
  ]),
  ...(Array.isArray(input.prompt)
    ? [
        asOpenRouterToolCallMessage({ executions: input.prompt }),
        ...asOpenRouterToolMessages({ executions: input.prompt }),
      ]
    : [{ role: 'user' as const, content: input.prompt }]),
];
