import OpenAI from 'openai';

import { runInNewContext } from 'node:vm';
import { isBodyCutError } from './isBodyCutError';

const TEST_CASES = [
  {
    description: 'a parse of a body that ends mid-json is a cut',
    given: { error: new SyntaxError('Unexpected end of JSON input') },
    expect: { output: true },
  },
  {
    description: "undici's raw `TypeError: terminated` is a cut",
    given: { error: new TypeError('terminated') },
    expect: { output: true },
  },
  {
    // .why = node's fetch raises in its own realm, so its TypeError fails `instanceof`
    //        in a jest vm; measured on a real socket in the socket integration test
    description: 'a `TypeError: terminated` from another realm is a cut',
    given: { error: runInNewContext("new TypeError('terminated')") },
    expect: { output: true },
  },
  {
    description: 'an error whose cause is coded UND_ERR_SOCKET is a cut',
    given: {
      error: Object.assign(new Error('other side closed'), {
        cause: { code: 'UND_ERR_SOCKET' },
      }),
    },
    expect: { output: true },
  },
  {
    description:
      'an sdk connection error wrapped around a socket death is a cut',
    given: {
      error: new OpenAI.APIConnectionError({
        cause: new TypeError('terminated'),
      }),
    },
    expect: { output: true },
  },
  {
    description: 'an sdk connection error with no socket death is not a cut',
    given: {
      error: new OpenAI.APIConnectionError({
        cause: new Error('getaddrinfo ENOTFOUND'),
      }),
    },
    expect: { output: false },
  },
  {
    description: 'an sdk timeout is not a cut (it is a stall)',
    given: { error: new OpenAI.APIConnectionTimeoutError() },
    expect: { output: false },
  },
  {
    description: 'an unrelated TypeError is not a cut',
    given: { error: new TypeError('x is not a function') },
    expect: { output: false },
  },
  {
    description: 'a non-error is not a cut',
    given: { error: 'terminated' },
    expect: { output: false },
  },
];

describe('isBodyCutError', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isBodyCutError({ error: thisCase.given.error })).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
