import { isJsonText } from './isJsonText';

const TEST_CASES = [
  {
    description: 'an object parses as json',
    given: { content: '{"verdict":"ok"}' },
    expect: { output: true },
  },
  {
    description: 'a bare number parses as json',
    given: { content: '17' },
    expect: { output: true },
  },
  {
    description: 'prose does not parse as json',
    given: { content: 'sure! here is the verdict: ok' },
    expect: { output: false },
  },
  {
    description: 'a cut object does not parse as json',
    given: { content: '{"verdict":' },
    expect: { output: false },
  },
  {
    description: 'an empty reply does not parse as json',
    given: { content: '' },
    expect: { output: false },
  },
];

describe('isJsonText', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isJsonText(thisCase.given)).toEqual(thisCase.expect.output);
    }),
  );
});
