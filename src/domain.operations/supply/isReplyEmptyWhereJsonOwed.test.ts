import type OpenAI from 'openai';

import { isReplyEmptyWhereJsonOwed } from './isReplyEmptyWhereJsonOwed';

/**
 * .what = a reply with one choice, as openrouter returns it
 */
const genReply = (input: {
  finishReason: string | null;
  content: string | null;
  toolCalls: unknown[] | null;
}): OpenAI.ChatCompletion =>
  ({
    id: 'gen-1',
    choices: [
      {
        index: 0,
        finish_reason: input.finishReason,
        message: {
          role: 'assistant',
          content: input.content,
          ...(input.toolCalls ? { tool_calls: input.toolCalls } : {}),
        },
      },
    ],
  }) as unknown as OpenAI.ChatCompletion; // .note = openrouter's 'error' finish reason is absent from the sdk's union. removal: when the sdk's union includes it

const TEST_CASES = [
  {
    description: 'an empty stop reply where json is owed is empty (issue #24)',
    given: {
      finishReason: 'stop',
      content: '',
      toolCalls: null,
      expectsJson: true,
    },
    expect: true,
  },
  {
    description: 'a whitespace-only stop reply where json is owed is empty',
    given: {
      finishReason: 'stop',
      content: '  \n',
      toolCalls: null,
      expectsJson: true,
    },
    expect: true,
  },
  {
    description: 'a null-content stop reply where json is owed is empty',
    given: {
      finishReason: 'stop',
      content: null,
      toolCalls: null,
      expectsJson: true,
    },
    expect: true,
  },
  {
    description: 'an empty stop reply to a plain ask is no defect',
    given: {
      finishReason: 'stop',
      content: '',
      toolCalls: null,
      expectsJson: false,
    },
    expect: false,
  },
  {
    description: 'a tool call request carries no content by design',
    given: {
      finishReason: 'stop',
      content: '',
      toolCalls: [{ id: 't1' }],
      expectsJson: true,
    },
    expect: false,
  },
  {
    description:
      'a reply cut at the output limit is the thought-exhausted case, never this one',
    given: {
      finishReason: 'length',
      content: '',
      toolCalls: null,
      expectsJson: true,
    },
    expect: false,
  },
  {
    description: 'a stop reply with content is served',
    given: {
      finishReason: 'stop',
      content: '{"ok":true}',
      toolCalls: null,
      expectsJson: true,
    },
    expect: false,
  },
];

describe('isReplyEmptyWhereJsonOwed', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(
        isReplyEmptyWhereJsonOwed({
          response: genReply(thisCase.given),
          expectsJson: thisCase.given.expectsJson,
        }),
      ).toEqual(thisCase.expect);
    }),
  );
});
