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
  tokensOutput?: number;
  tokensThought?: number;
  costUsd?: number;
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
        completion_tokens: input.tokensOutput ?? 0,
        total_tokens: 236000,
        ...(input.costUsd === undefined ? {} : { cost: input.costUsd }),
        ...(input.tokensThought === undefined
          ? {}
          : {
              completion_tokens_details: {
                reasoning_tokens: input.tokensThought,
              },
            }),
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
        tokensOutput: 4000,
        tokensThought: 400,
      },
      expect: { defect: 'ask for a shorter reply' },
    },
    // .why = 0.1.3's shape: a cut reply with no output count and no usage detail still
    //        names the cut in its headline
    {
      description:
        'a reply cut at the output limit, with 0 output tokens and no usage detail, names the cut',
      given: {
        content: '{"blockers":',
        finishReason: 'length',
        expectsJson: true,
      },
      expect: { defect: 'cut off at the output limit (finish_reason=length)' },
    },
    // .why = a cut reply mostly thought is the all-thought case one step short; its fix
    //        is a thought cap, never a shorter reply
    {
      description:
        'a reply cut at the output limit, mostly thought, names a thought cap as its fix',
      given: {
        content: '{"blockers":',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 4000,
        tokensThought: 3800,
      },
      expect: {
        defect: 'fix: cap thought (effort on the ask), since 3800 of 4000',
      },
    },
    {
      description: 'an all-thought reply names what openrouter billed for it',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 4000,
        tokensThought: 4000,
        costUsd: 0.0172,
      },
      expect: { defect: 'billed $0.0172' },
    },
    // 🔴 .why = measured in rhachet-roles-bhrain: a review ask thought to the output
    //           limit, wrote no verdict, and read "ask for a shorter reply" (case=2)
    {
      description:
        'an all-thought reply with no budget names the thought, and a budget to set (case=2 [t2])',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 8000,
        tokensThought: 7998,
      },
      expect: {
        defect:
          'spent the whole reply on thought, and wrote no answer (7998 of 8000 output tokens were thought',
      },
    },
    {
      description:
        'an all-thought reply with no usage counts names a placeholder budget, never a guess',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
      },
      expect: {
        defect: 'effort: { budget: { tokens: N } }',
      },
    },
    {
      description:
        'an all-thought reply with a budget names the budget to lower (case=2 [t1])',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 8000,
        tokensThought: 7900,
        tokensThoughtBudget: 7900,
      },
      expect: { defect: 'lower effort.budget.tokens (now 7900)' },
    },
    {
      description:
        'an all-thought reply from a host with a vast output room suggests a capped budget, never the room',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 384000,
        tokensThought: 383990,
      },
      expect: { defect: 'effort: { budget: { tokens: 8000 } }' },
    },
    {
      description:
        'an all-thought reply that thought far past its budget names the host that ignored the cap',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 384000,
        tokensThought: 383990,
        tokensThoughtBudget: 6000,
      },
      expect: {
        defect:
          'the host did not honor effort.budget.tokens (383990 thought against a budget of 6000)',
      },
    },
    {
      description:
        'an all-thought reply under a level names a lower level, or a budget',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 8000,
        tokensThought: 7990,
        thoughtLevel: 'high',
      },
      expect: { defect: "lower effort (now 'high'), or set a budget" },
    },
    {
      description:
        'an all-thought reply under the lowest level names a budget, never a lower level',
      given: {
        content: '',
        finishReason: 'length',
        expectsJson: true,
        tokensOutput: 8000,
        tokensThought: 7990,
        thoughtLevel: 'minimal',
      },
      expect: {
        defect:
          "effort is already at its lowest level ('minimal'). set a budget",
      },
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
        tokensThoughtBudget:
          'tokensThoughtBudget' in thisCase.given
            ? (thisCase.given.tokensThoughtBudget ?? null)
            : null,
        thoughtLevel:
          'thoughtLevel' in thisCase.given
            ? (thisCase.given.thoughtLevel ?? null)
            : null,
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
      tokensThoughtBudget: null,
      thoughtLevel: null,
    });
    expect(defect).toBeInstanceOf(MalfunctionError);
    expect(defect?.message).toContain('finish_reason=none, 0 chars');
    expect(defect?.message).toContain(
      'openrouter said: Provider returned error',
    );
    expect(defect?.message).toMatchSnapshot();
  });

  test('each defect names its kind in metadata, so a caller can branch on it', () => {
    const kindOf = (given: {
      content: string;
      finishReason: string;
      expectsJson: boolean;
    }) =>
      getOneReplyDefectError({
        response: genResponse(given),
        supply: SUPPLY,
        expectsJson: given.expectsJson,
        tokensThoughtBudget: null,
        thoughtLevel: null,
      })?.metadata?.defect ?? null;
    expect({
      allThought: kindOf({
        content: '',
        finishReason: 'length',
        expectsJson: true,
      }),
      cutOff: kindOf({
        content: '{"a":',
        finishReason: 'length',
        expectsJson: true,
      }),
      failed: kindOf({
        content: '',
        finishReason: 'error',
        expectsJson: false,
      }),
      empty: kindOf({ content: '', finishReason: 'stop', expectsJson: true }),
      prose: kindOf({ content: 'hi', finishReason: 'stop', expectsJson: true }),
    }).toEqual({
      allThought: 'all-thought',
      cutOff: 'cut-off',
      failed: 'failed',
      empty: 'empty',
      prose: 'prose',
    });
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
      tokensThoughtBudget: null,
      thoughtLevel: null,
    });
    expect(defect).toBeNull();
  });
});
