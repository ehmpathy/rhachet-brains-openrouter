import { ConstraintError } from 'helpful-errors';
import { asIsoDateStamp, asIsoTimeStamp } from 'iso-time';
import { getError, given, then, useThen, when } from 'test-fns';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import { getOneCatalogModel } from './getOneCatalogModel';

/**
 * .what = a catalog shaped like openrouter's: listed ids, one dated
 * .why = the lookup reads only id + date; a fake sdk serves it offline
 */
const CATALOG: OpenRouterCatalogModel[] = [
  { id: 'deepseek/deepseek-v4.1-flash', expiresOn: null },
  { id: 'deepseek/deepseek-v4.1-pro', expiresOn: null },
  { id: 'qwen/qwen3.6-max', expiresOn: null },
  { id: 'qwen/qwen3-max', expiresOn: asIsoDateStamp('2026-10-09') },
].map((model) => ({
  ...model,
  createdAt: asIsoTimeStamp('2026-01-01T00:00:00.000Z'),
}));

const context = {
  sdkOpenRouterEndpoints: {
    getAllCatalogModels: async () => CATALOG,
  },
};

describe('getOneCatalogModel', () => {
  given('[case1] an id the catalog lists', () => {
    when('[t0] it is looked up', () => {
      const resolved = useThen('it resolves', async () => ({
        model: await getOneCatalogModel(
          {
            model: 'deepseek/deepseek-v4.1-flash',
            filterSuffix: '/floor',
            apiKey: 'test-key',
          },
          context,
        ),
      }));

      then('the id is returned as written', () => {
        expect(resolved.model).toEqual('deepseek/deepseek-v4.1-flash');
      });
    });
  });

  given('[case2] a typo of a listed id', () => {
    when('[t0] it is looked up', () => {
      const refused = useThen('it is refused', async () => ({
        error: await getError(
          getOneCatalogModel(
            {
              model: 'deepseek/deepseek-v4.1-flsh',
              filterSuffix: '/floor&speed=min50tps',
              apiKey: 'test-key',
            },
            context,
          ),
        ),
      }));

      then('the refusal is a ConstraintError, before any call', () => {
        expect(refused.error).toBeInstanceOf(ConstraintError);
        expect(refused.error.message).toContain('no call was sent');
      });

      then('it offers the nearest id as a ready slug, filters kept', () => {
        expect(refused.error.message).toContain(
          'openrouter/deepseek/deepseek-v4.1-flash/floor&speed=min50tps',
        );
      });

      then('the message matches snapshot', () => {
        expect(refused.error.message).toMatchSnapshot();
      });
    });
  });
});
