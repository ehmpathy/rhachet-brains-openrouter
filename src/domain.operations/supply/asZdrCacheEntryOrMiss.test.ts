import { asZdrCacheEntryOrMiss } from './asZdrCacheEntryOrMiss';

const TEST_CASES = [
  {
    description: 'a well-formed entry is kept',
    given: { cached: '{"at":1,"index":{"z-ai/glm-5.3":["deepinfra/fp8"]}}' },
    expect: { at: 1, index: { 'z-ai/glm-5.3': ['deepinfra/fp8'] } },
  },
  {
    description: 'a json null is a miss',
    given: { cached: 'null' },
    expect: null,
  },
  {
    description: 'a bare number is a miss',
    given: { cached: '42' },
    expect: null,
  },
  {
    description: 'an array from another shape is a miss',
    given: { cached: '[{"model_id":"x"}]' },
    expect: null,
  },
  {
    description: 'an entry with no timestamp is a miss',
    given: { cached: '{"index":{}}' },
    expect: null,
  },
];

describe('asZdrCacheEntryOrMiss', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asZdrCacheEntryOrMiss(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
