import { asBrainSizeForAsk } from './asBrainSizeForAsk';

describe('asBrainSizeForAsk', () => {
  test('chars in sum the system prompt and the prompt; chars out are the reply', () => {
    const size = asBrainSizeForAsk({
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
      systemPrompt: 'be brief',
      promptText: 'surf report?',
      content: 'glassy',
    });
    expect(size.chars).toEqual({
      input: 'be brief'.length + 'surf report?'.length,
      output: 'glassy'.length,
      cache: { get: 0, set: 0 },
    });
  });

  test('no system prompt counts zero chars for it', () => {
    const size = asBrainSizeForAsk({
      usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
      systemPrompt: null,
      promptText: 'hi',
      content: '',
    });
    expect(size.chars.input).toEqual(2);
    expect(size.chars.output).toEqual(0);
  });
});
