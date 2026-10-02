import { asIsoDateStamp, asIsoTimeStamp } from 'iso-time';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import { getAllSimilarModelIds } from './getAllSimilarModelIds';

const CREATED_AT = asIsoTimeStamp('2026-01-01T00:00:00.000Z');

/**
 * .what = a slice of the openrouter catalog, shaped as `/models` returns ids
 * .why = the rank is tested over real-shaped ids, never invented ones
 */
const CATALOG_UNDATED: OpenRouterCatalogModel[] = [
  'acme/new-model',
  'acme/old-model',
  'deepseek/deepseek-v4.1-flash',
  'deepseek/deepseek-v4-pro-0813',
  'moonshotai/kimi-k3',
  'z-ai/glm-5.3',
  'z-ai/glm-5.3-flash',
].map((id) => ({ id, createdAt: CREATED_AT, expiresOn: null }));

/**
 * .what = an id openrouter has dated for withdrawal
 * .why = it sits one edit from a typo below, so only the date can keep it out
 */
const MODEL_DATED: OpenRouterCatalogModel = {
  id: 'z-ai/glm-5.2',
  createdAt: CREATED_AT,
  expiresOn: asIsoDateStamp('2026-10-20'),
};

const CATALOG = [...CATALOG_UNDATED, MODEL_DATED];

const TEST_CASES = [
  {
    description: 'a one-swap typo ranks its intended id first',
    given: { id: 'acme/new-modle', limit: 5 },
    expect: { head: 'acme/new-model', length: 5 },
  },
  {
    description: 'a dropped char ranks its intended id first',
    given: { id: 'z-ai/glm-53', limit: 5 },
    expect: { head: 'z-ai/glm-5.3', length: 5 },
  },
  {
    description: 'a wrong version ranks its sibling version first',
    given: { id: 'deepseek/deepseek-v4.2-flash', limit: 5 },
    expect: { head: 'deepseek/deepseek-v4.1-flash', length: 5 },
  },
  {
    description: 'the limit caps the list',
    given: { id: 'moonshotai/kimi-k2', limit: 2 },
    expect: { head: 'moonshotai/kimi-k3', length: 2 },
  },
  {
    description: 'a limit above the catalog returns every undated id',
    given: { id: 'absent/unknown-model', limit: 50 },
    expect: { head: null, length: CATALOG_UNDATED.length },
  },
];

describe('getAllSimilarModelIds', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const similar = getAllSimilarModelIds({
        id: thisCase.given.id,
        catalog: CATALOG,
        limit: thisCase.given.limit,
      });
      expect(similar).toHaveLength(thisCase.expect.length);
      if (thisCase.expect.head)
        expect(similar[0]).toEqual(thisCase.expect.head);
    }),
  );

  test('the rank is by distance, never by catalog order', () => {
    const similar = getAllSimilarModelIds({
      id: 'z-ai/glm-5.3-flsh',
      catalog: [...CATALOG].reverse(),
      limit: 2,
    });
    expect(similar).toEqual(['z-ai/glm-5.3-flash', 'z-ai/glm-5.3']);
  });

  test('a dated id is never offered, however near', () => {
    // .why = `z-ai/glm-5.2` is one edit from the typo, nearer than any other
    const similar = getAllSimilarModelIds({
      id: 'z-ai/glm-5.2x',
      catalog: CATALOG,
      limit: 50,
    });
    expect(similar).not.toContain(MODEL_DATED.id);
    expect(similar[0]).toEqual('z-ai/glm-5.3');
  });
});
