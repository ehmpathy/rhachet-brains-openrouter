import type OpenAI from 'openai';

import { isReplyFailed } from './isReplyFailed';

/**
 * .what = a chat completion with one choice, or none
 * .why = the check reads only the first choice's finish reason and tool calls
 */
const genResponse = (input: {
  finishReason: string | null;
  toolCalls: boolean;
  noChoice?: boolean;
}): OpenAI.ChatCompletion =>
  ({
    id: 'gen-1',
    object: 'chat.completion',
    created: 0,
    model: 'deepseek/deepseek-v4.1-flash',
    choices: input.noChoice
      ? []
      : [
          {
            index: 0,
            logprobs: null,
            finish_reason: input.finishReason,
            message: {
              role: 'assistant',
              content: '',
              refusal: null,
              ...(input.toolCalls
                ? {
                    tool_calls: [
                      {
                        id: 'call-1',
                        type: 'function',
                        function: { name: 'getWaveReport', arguments: '{}' },
                      },
                    ],
                  }
                : {}),
            },
          },
        ],
  }) as OpenAI.ChatCompletion; // .note = openrouter's 'error' finish reason is absent from the sdk's union. removal: when the sdk types widen `finish_reason` to string

describe('isReplyFailed', () => {
  const TEST_CASES = [
    {
      description: 'a reply that ended in error failed',
      given: { finishReason: 'error', toolCalls: false },
      expect: true,
    },
    {
      description: 'a reply with no finish reason failed',
      given: { finishReason: null, toolCalls: false },
      expect: true,
    },
    {
      description: 'a reply with no choice at all failed',
      given: { finishReason: null, toolCalls: false, noChoice: true },
      expect: true,
    },
    {
      description: 'a reply that stopped did not fail',
      given: { finishReason: 'stop', toolCalls: false },
      expect: false,
    },
    {
      description: 'a reply cut at the output limit did not fail mid-reply',
      given: { finishReason: 'length', toolCalls: false },
      expect: false,
    },
    {
      description:
        'a tool call request never failed, though its content is empty',
      given: { finishReason: null, toolCalls: true },
      expect: false,
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isReplyFailed({ response: genResponse(thisCase.given) })).toEqual(
        thisCase.expect,
      );
    }),
  );

  // .why = measured 2026-10-02: a 200 body held an `error` where `choices` belongs
  test('a 200 body with no choices array failed, never a TypeError', () => {
    expect(
      isReplyFailed({
        response: JSON.parse(
          JSON.stringify({ id: 'gen-1', error: { message: 'upstream' } }),
        ),
      }),
    ).toEqual(true);
  });
});
