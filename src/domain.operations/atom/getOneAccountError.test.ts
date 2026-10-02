import { ConstraintError } from 'helpful-errors';
import OpenAI from 'openai';
import { given, then, when } from 'test-fns';

import { getOneAccountError } from './getOneAccountError';

/**
 * .what = an api error as the openai client raises it for a given status
 * .why = the transformer keys on `OpenAI.APIError` + status, so the fixture
 *        must be the real class, never a look-alike
 */
const genApiError = (input: { status: number; message: string }) =>
  new OpenAI.APIError(input.status, undefined, input.message, new Headers());

describe('getOneAccountError', () => {
  given('[case1] openrouter answers 402 insufficient credits', () => {
    const error = genApiError({
      status: 402,
      message: '402 Insufficient credits',
    });

    when('[t0] the error is classified', () => {
      const built = getOneAccountError({ error });

      then('it builds a named error', () => {
        expect(built).toBeInstanceOf(ConstraintError);
      });

      then('it asks the caller to add credits', () => {
        expect(built?.message).toContain('please add credits');
        expect(built?.message).toContain(
          'https://openrouter.ai/settings/credits',
        );
      });

      then('the message matches snapshot', () => {
        expect(built?.message).toMatchSnapshot();
      });
    });
  });

  given('[case2] openrouter answers 401 for a bad key', () => {
    const error = genApiError({
      status: 401,
      message: '401 No auth credentials',
    });

    when('[t0] the error is classified', () => {
      const built = getOneAccountError({ error });

      then('it asks the caller to check the key', () => {
        expect(built).toBeInstanceOf(ConstraintError);
        expect(built?.message).toContain('please check the key');
      });

      then('the message matches snapshot', () => {
        expect(built?.message).toMatchSnapshot();
      });
    });
  });

  given('[case3] an error that is not an account fault', () => {
    when('[t0] a 500 from the upstream is classified', () => {
      then('it returns null, so the original rethrows untouched', () => {
        const error = genApiError({ status: 500, message: '500 upstream' });
        expect(getOneAccountError({ error })).toBeNull();
      });
    });

    when('[t1] a plain error with no status is classified', () => {
      then('it returns null', () => {
        expect(getOneAccountError({ error: new Error('boom') })).toBeNull();
      });
    });
  });
});
