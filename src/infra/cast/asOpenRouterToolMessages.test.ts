import { ConstraintError } from 'helpful-errors';
import type { BrainPlugToolExecution } from 'rhachet/brains';
import { getError } from 'test-fns';

import { asOpenRouterToolMessages } from './asOpenRouterToolMessages';

const EXECUTION_SUCCESS: BrainPlugToolExecution = {
  exid: 'call-1',
  slug: 'getWaveReport',
  input: { spot: 'pipeline' },
  signal: 'success',
  output: { heightFt: 6 },
  metrics: { cost: { time: { milliseconds: 12 } } },
};

const EXECUTION_ERROR: BrainPlugToolExecution = {
  exid: 'call-2',
  slug: 'getWaveReport',
  input: { spot: 'mavericks' },
  signal: 'error:constraint',
  output: { error: new Error('spot closed for the season') },
  metrics: { cost: { time: { milliseconds: 3 } } },
};

describe('asOpenRouterToolMessages', () => {
  const TEST_CASES = [
    {
      description: 'a success becomes a tool message with the output as json',
      given: { executions: [EXECUTION_SUCCESS] },
      expect: [
        { role: 'tool', tool_call_id: 'call-1', content: '{"heightFt":6}' },
      ],
    },
    {
      description:
        'an error becomes a tool message that names the error and its signal',
      given: { executions: [EXECUTION_ERROR] },
      expect: [
        {
          role: 'tool',
          tool_call_id: 'call-2',
          content:
            '{"error":"spot closed for the season","signal":"error:constraint"}',
        },
      ],
    },
    {
      description: 'many executions keep their order, one message each',
      given: { executions: [EXECUTION_SUCCESS, EXECUTION_ERROR] },
      expect: [
        { role: 'tool', tool_call_id: 'call-1' },
        { role: 'tool', tool_call_id: 'call-2' },
      ],
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asOpenRouterToolMessages(thisCase.given)).toMatchObject(
        thisCase.expect,
      );
    }),
  );

  test('an error execution with no error in its output fails with a named error', () => {
    // .why = a caller's tool loop at runtime can break the type's promise;
    //        a json round trip builds that shape with no cast
    const genMalformed = (): BrainPlugToolExecution =>
      JSON.parse(
        JSON.stringify({ ...EXECUTION_ERROR, output: { reason: 'closed' } }),
      );
    const error = getError(() =>
      asOpenRouterToolMessages({ executions: [genMalformed()] }),
    );
    expect(error).toBeInstanceOf(ConstraintError);
    expect(error.message).toContain("tool execution 'call-2'");
    expect(error.message).toMatchSnapshot();
  });
});
