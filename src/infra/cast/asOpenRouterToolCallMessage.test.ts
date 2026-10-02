import type { BrainPlugToolExecution } from 'rhachet/brains';

import { asOpenRouterToolCallMessage } from './asOpenRouterToolCallMessage';

const genExecution = (input: {
  exid: string;
  spot: string;
}): BrainPlugToolExecution => ({
  exid: input.exid,
  slug: 'getWaveReport',
  input: { spot: input.spot },
  signal: 'success',
  output: { heightFt: 6 },
  metrics: { cost: { time: { milliseconds: 12 } } },
});

describe('asOpenRouterToolCallMessage', () => {
  test('the executions become one assistant message, one tool call each, in order', () => {
    const message = asOpenRouterToolCallMessage({
      executions: [
        genExecution({ exid: 'call-1', spot: 'pipeline' }),
        genExecution({ exid: 'call-2', spot: 'trestles' }),
      ],
    });
    expect(message).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'getWaveReport', arguments: '{"spot":"pipeline"}' },
        },
        {
          id: 'call-2',
          type: 'function',
          function: { name: 'getWaveReport', arguments: '{"spot":"trestles"}' },
        },
      ],
    });
  });
});
