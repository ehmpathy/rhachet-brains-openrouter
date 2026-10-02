import { MalfunctionError } from 'helpful-errors';
import { getError } from 'test-fns';

import { asZdrTagsByModel } from './asZdrTagsByModel';

describe('asZdrTagsByModel', () => {
  test('each model holds the tags of its zero-retention endpoints', () => {
    const index = asZdrTagsByModel({
      body: {
        data: [
          { model_id: 'deepseek/deepseek-v4.1-flash', tag: 'deepinfra/fp8' },
          { model_id: 'deepseek/deepseek-v4.1-flash', tag: 'novita/fp8' },
          { model_id: 'moonshotai/kimi-k3', tag: 'groq' },
        ],
      },
    });
    expect(index).toEqual({
      'deepseek/deepseek-v4.1-flash': ['deepinfra/fp8', 'novita/fp8'],
      'moonshotai/kimi-k3': ['groq'],
    });
  });

  test('a row with `model` and `provider_name` reads as model and tag', () => {
    const index = asZdrTagsByModel({
      body: { data: [{ model: 'z-ai/glm-5.3', provider_name: 'Novita' }] },
    });
    expect(index).toEqual({ 'z-ai/glm-5.3': ['Novita'] });
  });

  test('a row with no tag matches no endpoint, so it is left out', () => {
    const index = asZdrTagsByModel({
      body: { data: [{ model_id: 'z-ai/glm-5.3' }] },
    });
    expect(index).toEqual({});
  });

  const TEST_CASES_DRIFT = [
    { description: 'a body with no `data`', body: { rows: [] } },
    { description: 'a body whose `data` is not an array', body: { data: {} } },
    { description: 'a null body', body: null },
  ];
  TEST_CASES_DRIFT.map((thisCase) =>
    test(`${thisCase.description} fails loud, and names the read`, async () => {
      const error = await getError(() =>
        asZdrTagsByModel({ body: thisCase.body }),
      );
      expect(error).toBeInstanceOf(MalfunctionError);
      expect(error.message).toContain('/endpoints/zdr reply drifted');
      expect(error.message).toMatchSnapshot();
    }),
  );
});
