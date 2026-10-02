import { asCachedJsonOrMiss } from './asCachedJsonOrMiss';

const TEST_CASES = [
  {
    description: 'an absent value is a miss',
    given: { value: undefined },
    expect: undefined,
  },
  {
    description: 'a valid json value is kept',
    given: { value: '{"at":1,"index":{}}' },
    expect: '{"at":1,"index":{}}',
  },
  {
    description: 'a truncated json value is a miss',
    given: { value: '{"at":1,"ind' },
    expect: undefined,
  },
  {
    description: 'an empty value is a miss',
    given: { value: '' },
    expect: undefined,
  },
];

describe('asCachedJsonOrMiss', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asCachedJsonOrMiss(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
