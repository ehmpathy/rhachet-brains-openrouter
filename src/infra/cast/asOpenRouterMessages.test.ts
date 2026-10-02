import type { BrainPlugToolExecution } from 'rhachet/brains';

import { asOpenRouterMessages } from './asOpenRouterMessages';

const EXECUTION_SUCCESS: BrainPlugToolExecution = {
  exid: 'call-1',
  slug: 'getWaveReport',
  input: { spot: 'pipeline' },
  signal: 'success',
  output: { heightFt: 6 },
  metrics: { cost: { time: { milliseconds: 12 } } },
};

describe('asOpenRouterMessages', () => {
  const TEST_CASES = [
    {
      description: 'a bare prompt with no system prompt is one user message',
      given: { systemPrompt: null, exchanges: [], prompt: 'surf today?' },
      expect: [{ role: 'user', content: 'surf today?' }],
    },
    {
      description:
        'the system prompt leads, then each exchange in order, then the prompt',
      given: {
        systemPrompt: 'you are a surf forecaster',
        exchanges: [{ input: 'hi', output: 'aloha' }],
        prompt: 'surf today?',
      },
      expect: [
        { role: 'system', content: 'you are a surf forecaster' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'aloha' },
        { role: 'user', content: 'surf today?' },
      ],
    },
    {
      description:
        'a tool continuation sends the assistant tool_calls, then each result',
      given: {
        systemPrompt: null,
        exchanges: [],
        prompt: [EXECUTION_SUCCESS],
      },
      expect: [
        {
          role: 'assistant',
          tool_calls: [{ id: 'call-1', function: { name: 'getWaveReport' } }],
        },
        { role: 'tool', tool_call_id: 'call-1', content: '{"heightFt":6}' },
      ],
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const messages = asOpenRouterMessages(thisCase.given);
      expect(messages).toHaveLength(thisCase.expect.length);
      expect(messages).toMatchObject(thisCase.expect);
    }),
  );
});
