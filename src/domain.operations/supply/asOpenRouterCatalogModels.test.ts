import { MalfunctionError } from 'helpful-errors';
import { asIsoTimeStamp } from 'iso-time';
import { getError } from 'test-fns';

import { asOpenRouterCatalogModels } from './asOpenRouterCatalogModels';

describe('asOpenRouterCatalogModels', () => {
  test('each row keeps its id, its age, and its withdrawal date, if any', () => {
    // .note = 1767225600 unix seconds = 2026-01-01T00:00:00Z
    const catalog = asOpenRouterCatalogModels({
      body: {
        data: [
          {
            id: 'qwen/qwen3-max',
            created: 1767225600,
            expiration_date: '2026-10-09',
          },
          {
            id: 'qwen/qwen3.6-max',
            created: 1767225600,
            expiration_date: null,
          },
          { id: 'deepseek/deepseek-v4.1-flash', created: 1767225600 },
        ],
      },
    });
    const createdAt = asIsoTimeStamp('2026-01-01T00:00:00.000Z');
    expect(catalog).toEqual([
      { id: 'qwen/qwen3-max', createdAt, expiresOn: '2026-10-09' },
      { id: 'qwen/qwen3.6-max', createdAt, expiresOn: null },
      { id: 'deepseek/deepseek-v4.1-flash', createdAt, expiresOn: null },
    ]);
  });

  test('a row with no `created` is drift, and fails loud', async () => {
    const error = await getError(() =>
      asOpenRouterCatalogModels({ body: { data: [{ id: 'qwen/qwen3-max' }] } }),
    );
    expect(error).toBeInstanceOf(MalfunctionError);
    expect(error.message).toContain('data.0.created');
  });

  test('a row with no id is drift, and fails loud', async () => {
    const error = await getError(() =>
      asOpenRouterCatalogModels({ body: { data: [{ name: 'qwen' }] } }),
    );
    expect(error).toBeInstanceOf(MalfunctionError);
    expect(error.message).toContain('/models reply drifted');
    expect(error.message).toContain('data.0.id');
    expect(error.message).toMatchSnapshot();
  });

  const TEST_CASES_DRIFT = [
    { description: 'a body with no `data`', body: { models: [] } },
    { description: 'a body whose `data` is not an array', body: { data: {} } },
    { description: 'a null body', body: null },
  ];
  TEST_CASES_DRIFT.map((thisCase) =>
    test(`${thisCase.description} fails loud, and names the read`, async () => {
      const error = await getError(() =>
        asOpenRouterCatalogModels({ body: thisCase.body }),
      );
      expect(error).toBeInstanceOf(MalfunctionError);
      expect(error.message).toContain('/models reply drifted');
    }),
  );
});
