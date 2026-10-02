import { ConstraintError } from 'helpful-errors';
import { asIsoDateStamp, asIsoTimeStamp, type IsoDateStamp } from 'iso-time';
import { given, then, when } from 'test-fns';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import { getOneWithdrawnModelError } from './getOneWithdrawnModelError';

const TODAY: IsoDateStamp = asIsoDateStamp('2026-10-15');

/**
 * .what = a catalog shaped like openrouter's: live ids, one dated past, one dated ahead
 * .why = the transformer reads only id + date; the dates sit either side of TODAY
 */
const CATALOG: OpenRouterCatalogModel[] = [
  { id: 'qwen/qwen3-max', expiresOn: asIsoDateStamp('2026-10-09') }, // past — withdrawn
  { id: 'google/gemini-2.5-pro', expiresOn: asIsoDateStamp('2026-10-20') }, // ahead — still serves
  { id: 'qwen/qwen3.6-max', expiresOn: null },
  { id: 'qwen/qwen3-coder', expiresOn: null },
  { id: 'deepseek/deepseek-v4.1-flash', expiresOn: null },
].map((model) => ({
  ...model,
  createdAt: asIsoTimeStamp('2026-01-01T00:00:00.000Z'),
}));

const ERROR = new Error('404 This model has been deprecated');

const runOne = (input: { model: string }) =>
  getOneWithdrawnModelError({
    model: input.model,
    filterSuffix: '/floor',
    catalog: CATALOG,
    today: TODAY,
    error: ERROR,
  });

describe('getOneWithdrawnModelError', () => {
  given('[case1] a model the catalog lists with no date', () => {
    when('[t0] its refusal is read', () => {
      then('it is not a withdrawal; null, so the caller rethrows', () => {
        expect(runOne({ model: 'deepseek/deepseek-v4.1-flash' })).toEqual(null);
      });
    });
  });

  given('[case2] a model whose date is still ahead', () => {
    when('[t0] its refusal is read', () => {
      then('it is not yet withdrawn; null', () => {
        expect(runOne({ model: 'google/gemini-2.5-pro' })).toEqual(null);
      });
    });
  });

  given('[case3] a model whose date has passed', () => {
    when('[t0] its refusal is read', () => {
      const error = runOne({ model: 'qwen/qwen3-max' });

      then('it is a ConstraintError', () => {
        expect(error).toBeInstanceOf(ConstraintError);
      });

      then('it names the date', () => {
        expect(error?.message).toContain('on 2026-10-09');
      });

      then('it offers undated ids as ready slugs, never a dated one', () => {
        expect(error?.message).toContain('openrouter/qwen/qwen3.6-max/floor');
        expect(error?.message).not.toContain('- openrouter/qwen/qwen3-max/');
        expect(error?.message).not.toContain('gemini-2.5-pro');
      });

      then('the message matches snapshot', () => {
        expect(error?.message).toMatchSnapshot();
      });
    });
  });

  given('[case4] a model the catalog no longer lists', () => {
    when('[t0] its refusal is read', () => {
      const error = runOne({ model: 'acme/gone-model' });

      then('it is a withdrawal, said without a date', () => {
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error?.message).toContain('no longer lists it');
      });

      then('the message matches snapshot', () => {
        expect(error?.message).toMatchSnapshot();
      });
    });
  });
});
