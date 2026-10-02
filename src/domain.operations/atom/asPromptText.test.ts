import type { BrainPlugToolExecution } from 'rhachet/brains';

import { asPromptText } from './asPromptText';

const EXECUTION: BrainPlugToolExecution = {
  exid: 'call-1',
  slug: 'getWaveReport',
  input: { spot: 'pipeline' },
  signal: 'success',
  output: { heightFt: 6 },
  metrics: { cost: { time: { milliseconds: 12 } } },
};

describe('asPromptText', () => {
  test("the caller's words are the text, untouched", () => {
    expect(asPromptText({ prompt: 'how big are the waves?' })).toEqual(
      'how big are the waves?',
    );
  });

  test('tool executions are recorded as their json', () => {
    expect(asPromptText({ prompt: [EXECUTION] })).toEqual(
      JSON.stringify([EXECUTION]),
    );
  });
});
