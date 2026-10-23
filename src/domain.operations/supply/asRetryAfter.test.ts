import OpenAI from 'openai';

import { asRetryAfter } from './asRetryAfter';

/**
 * .what = a real sdk error with the given headers
 * .why = `asRetryAfter` reads `headers` off an `OpenAI.APIError` only
 */
const genApiError = (input: { headers: Headers | undefined }) =>
  new OpenAI.APIError(
    429,
    { message: 'Provider returned error', code: 429 },
    undefined,
    input.headers,
  );

const TEST_CASES = [
  {
    description: 'a throttle with a retry-after reads its wait',
    given: {
      error: genApiError({ headers: new Headers({ 'retry-after': '7' }) }),
    },
    expect: { output: '7' },
  },
  {
    description: 'a padded retry-after is trimmed',
    given: {
      error: genApiError({ headers: new Headers({ 'retry-after': ' 12 ' }) }),
    },
    expect: { output: '12' },
  },
  {
    description: 'a blank retry-after reads as no wait',
    given: {
      error: genApiError({ headers: new Headers({ 'retry-after': '  ' }) }),
    },
    expect: { output: null },
  },
  {
    description: 'a throttle with no retry-after reads as no wait',
    given: { error: genApiError({ headers: new Headers() }) },
    expect: { output: null },
  },
  {
    description: 'an sdk error with no headers reads as no wait',
    given: { error: genApiError({ headers: undefined }) },
    expect: { output: null },
  },
  {
    description: 'a non-sdk error reads as no wait',
    given: { error: new Error('socket hang up') },
    expect: { output: null },
  },
];

describe('asRetryAfter', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asRetryAfter({ error: thisCase.given.error })).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
