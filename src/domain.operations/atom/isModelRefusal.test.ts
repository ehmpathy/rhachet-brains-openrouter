import OpenAI from 'openai';

import { isModelRefusal } from './isModelRefusal';

describe('isModelRefusal', () => {
  const asApiError = (input: { status: number; message: string }) =>
    new OpenAI.APIError(input.status, undefined, input.message, new Headers());

  const TEST_CASES = [
    {
      description: 'a 404 is a refusal',
      error: asApiError({ status: 404, message: 'No endpoints found' }),
      expected: true,
    },
    {
      description: 'a deprecation named in another status is a refusal',
      error: asApiError({
        status: 400,
        message: 'This model has been deprecated',
      }),
      expected: true,
    },
    {
      description: 'a 500 is not a refusal',
      error: asApiError({ status: 500, message: 'upstream error' }),
      expected: false,
    },
    {
      description: 'a non-api error is not a refusal',
      error: new Error('socket hang up'),
      expected: false,
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isModelRefusal({ error: thisCase.error })).toEqual(
        thisCase.expected,
      );
    }),
  );
});
