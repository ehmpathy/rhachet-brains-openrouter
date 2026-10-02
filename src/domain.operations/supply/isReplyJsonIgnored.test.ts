import type OpenAI from 'openai';

import { isReplyJsonIgnored } from './isReplyJsonIgnored';

/**
 * .what = a reply shaped as openrouter returns it
 * .why = each case varies only the field it is about
 */
const genReply = (input: {
  finishReason: string;
  content: string;
  toolCalls: boolean;
}): OpenAI.ChatCompletion =>
  ({
    id: 'gen-fake',
    choices: [
      {
        index: 0,
        finish_reason: input.finishReason,
        message: {
          role: 'assistant',
          content: input.content,
          ...(input.toolCalls
            ? {
                tool_calls: [
                  {
                    id: 'call-1',
                    type: 'function',
                    function: { name: 'f', arguments: '{}' },
                  },
                ],
              }
            : {}),
        },
      },
    ],
  }) as unknown as OpenAI.ChatCompletion; // .note = openrouter's 'error' finish is absent from the sdk union; removal: when the sdk widens finish_reason

const TEST_CASES = [
  {
    description: 'a whole prose reply where json is owed is json-ignored',
    given: {
      finishReason: 'stop',
      content: 'Sure! here: ok',
      toolCalls: false,
      expectsJson: true,
    },
    expect: true,
  },
  {
    description: 'a json reply honors the schema',
    given: {
      finishReason: 'stop',
      content: '{"content":"ok"}',
      toolCalls: false,
      expectsJson: true,
    },
    expect: false,
  },
  {
    description: 'prose is a fine answer to a plain ask',
    given: {
      finishReason: 'stop',
      content: 'ok',
      toolCalls: false,
      expectsJson: false,
    },
    expect: false,
  },
  {
    description: 'a reply cut at the output limit proves no schema was ignored',
    given: {
      finishReason: 'length',
      content: '{"content":',
      toolCalls: false,
      expectsJson: true,
    },
    expect: false,
  },
  {
    description: 'a reply that failed mid-way proves no schema was ignored',
    given: {
      finishReason: 'error',
      content: 'partial',
      toolCalls: false,
      expectsJson: true,
    },
    expect: false,
  },
  {
    description: 'an empty reply is its own defect, never json-ignored',
    given: {
      finishReason: 'stop',
      content: '  ',
      toolCalls: false,
      expectsJson: true,
    },
    expect: false,
  },
  {
    description: 'a tool call request carries no content by design',
    given: {
      finishReason: 'stop',
      content: 'a tool will answer',
      toolCalls: true,
      expectsJson: true,
    },
    expect: false,
  },
];

describe('isReplyJsonIgnored', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const response = genReply(thisCase.given);
      expect(
        isReplyJsonIgnored({
          response,
          expectsJson: thisCase.given.expectsJson,
        }),
      ).toEqual(thisCase.expect);
    }),
  );
});
