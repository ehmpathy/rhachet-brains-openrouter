import type OpenAI from 'openai';

import { asBrainSizeTokens } from '../../infra/cast/asBrainSizeTokens';

/**
 * .what = the size of one ask: its tokens, as billed, and its chars, in and out
 * .why = metrics and the cost estimate read one size; the chars in are the
 *        system prompt plus the prompt text, the chars out are the reply
 *
 * .note = openrouter reports no cache chars, so both cache counts are 0
 */
export const asBrainSizeForAsk = (input: {
  usage: OpenAI.CompletionUsage | undefined;
  systemPrompt: string | null;
  promptText: string;
  content: string;
}): {
  tokens: ReturnType<typeof asBrainSizeTokens>;
  chars: { input: number; output: number; cache: { get: number; set: number } };
} => ({
  tokens: asBrainSizeTokens({ usage: input.usage }),
  chars: {
    input: (input.systemPrompt ?? '').length + input.promptText.length,
    output: input.content.length,
    cache: { get: 0, set: 0 },
  },
});
