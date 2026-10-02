import type OpenAI from 'openai';

import { getOneTokensEstimate } from './getOneTokensEstimate';

describe('getOneTokensEstimate', () => {
  test('the estimate is the serialized messages, at four chars per token, rounded up', () => {
    const messages = [{ role: 'user' as const, content: 'hi' }];
    const estimate = getOneTokensEstimate({
      request: { model: 'deepseek/deepseek-v4.1-flash', messages },
    });
    expect(estimate.input).toEqual(
      Math.ceil(JSON.stringify(messages).length / 4),
    );
  });

  // .why = i003 review asked whether key order moves the estimate; it cannot,
  //        since a reorder keeps every character. this clamps that claim
  test('one message built in two key orders estimates the same', () => {
    const estimateOf = (
      messages: OpenAI.ChatCompletionCreateParamsNonStreaming['messages'],
    ) =>
      getOneTokensEstimate({
        request: { model: 'deepseek/deepseek-v4.1-flash', messages },
      }).input;
    expect(
      estimateOf([{ role: 'user', content: 'what is the swell at pipeline?' }]),
    ).toEqual(
      estimateOf([{ content: 'what is the swell at pipeline?', role: 'user' }]),
    );
  });

  test('a longer ask estimates more tokens', () => {
    const short = getOneTokensEstimate({
      request: {
        model: 'deepseek/deepseek-v4.1-flash',
        messages: [{ role: 'user', content: 'hi' }],
      },
    });
    const long = getOneTokensEstimate({
      request: {
        model: 'deepseek/deepseek-v4.1-flash',
        messages: [{ role: 'user', content: 'hi '.repeat(400) }],
      },
    });
    expect(long.input).toBeGreaterThan(short.input + 250);
  });
});
