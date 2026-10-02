import { MalfunctionError } from 'helpful-errors';
import type OpenAI from 'openai';

import { getOneReplyDefectError } from './getOneReplyDefectError';

/**
 * .what = a chat completion with one choice, shaped as openrouter returns it
 * .why = `finish_reason` is typed wide here, since openrouter reports 'error',
 *        a value absent from the openai sdk's union
 */
const genResponse = (input: {
  content: string | null;
  finishReason: string | null;
  toolCalls?: OpenAI.ChatCompletionMessageToolCall[];
}): OpenAI.ChatCompletion =>
  JSON.parse(
    JSON.stringify({
      id: 'gen-1',
      object: 'chat.completion',
      created: 0,
      model: 'deepseek/deepseek-v4-flash',
      choices: [
        {
          index: 0,
          finish_reason: input.finishReason,
          logprobs: null,
          message: {
            role: 'assistant',
            content: input.content,
            refusal: null,
            ...(input.toolCalls ? { tool_calls: input.toolCalls } : {}),
          },
        },
      ],
      usage: {
        prompt_tokens: 236000,
        completion_tokens: 0,
        total_tokens: 236000,
      },
    }),
  );

const SUPPLY = { provider: 'DeepInfra', generationId: 'gen-1' };

describe('getOneReplyDefectError', () => {
  const TEST_CASES = [
    {
      description: 'a sound json reply passes',
      given: {
        content: '{"blockers":0}',
        finishReason: 'stop',
        expectsJson: true,
      },
      expect: { defect: null },
    },
    {
      description: 'a plain-string ask may answer empty with stop',
      given: { content: '', finishReason: 'stop', expectsJson: false },
      expect: { defect: null },
    },
    // .why = measured 2026-10-02: a review lane got an empty json reply and read it as a malfunction
    {
      description: 'an empty reply where json is owed is refused',
      given: { content: '', finishReason: 'stop', expectsJson: true },
      expect: {
        defect:
          'returned no usable reply (finish_reason=stop, 0 chars). the host replied empty where a json schema was owed.',
      },
    },
    {
      description:
        'a provider that failed mid-reply is refused, even for a string ask',
      given: { content: '', finishReason: 'error', expectsJson: false },
      expect: {
        defect:
          'finish_reason=error, 0 chars). the upstream provider likely failed mid-reply.',
      },
    },
    {
      description: 'a reply with no finish reason is refused',
      given: { content: null, finishReason: null, expectsJson: true },
      expect: { defect: 'finish_reason=none' },
    },
    {
      description: 'a reply cut at the output limit is refused, as partial',
      given: {
        content: '{"blockers":',
        finishReason: 'length',
        expectsJson: true,
      },
      expect: { defect: 'cut off at the output limit (finish_reason=length)' },
    },
    // .why = measured 2026-10-02: a host answered prose where a json schema was owed
    {
      description:
        'a prose reply where json is owed is refused, and names the host',
      given: {
        content: 'Acknowledged. ZEBRA42',
        finishReason: 'stop',
        expectsJson: true,
      },
      expect: {
        defect: 'host DeepInfra ignored the json schema asked for',
      },
    },
    {
      description: 'a prose reply to a plain-string ask passes',
      given: {
        content: 'Acknowledged. ZEBRA42',
        finishReason: 'stop',
        expectsJson: false,
      },
      expect: { defect: null },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const defect = getOneReplyDefectError({
        response: genResponse(thisCase.given),
        supply: SUPPLY,
        expectsJson: thisCase.given.expectsJson,
      });
      if (thisCase.expect.defect === null) return expect(defect).toBeNull();
      expect(defect).toBeInstanceOf(MalfunctionError);
      expect(defect?.message).toContain(thisCase.expect.defect);
      expect(defect?.message).toContain('generation gen-1, provider DeepInfra');
      expect(defect?.message).toMatchSnapshot();
    }),
  );

  // 🔴 .why = measured 2026-10-02: two review lanes crashed with a bare
  //           TypeError on a 200 body that held an `error` where `choices` belongs
  test('a 200 body with an error in place of choices is refused, and quotes openrouter', () => {
    const defect = getOneReplyDefectError({
      response: JSON.parse(
        JSON.stringify({
          id: 'gen-1',
          object: 'chat.completion',
          error: { message: 'Provider returned error', code: 502 },
        }),
      ),
      supply: SUPPLY,
      expectsJson: true,
    });
    expect(defect).toBeInstanceOf(MalfunctionError);
    expect(defect?.message).toContain('finish_reason=none, 0 chars');
    expect(defect?.message).toContain(
      'openrouter said: Provider returned error',
    );
    expect(defect?.message).toMatchSnapshot();
  });

  test('a tool call request passes, though its content is empty', () => {
    const defect = getOneReplyDefectError({
      response: genResponse({
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'getWaveReport', arguments: '{}' },
          },
        ],
      }),
      supply: SUPPLY,
      expectsJson: true,
    });
    expect(defect).toBeNull();
  });
});
