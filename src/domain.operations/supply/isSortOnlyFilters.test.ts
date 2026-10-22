import { asSupplyFilters } from './asSupplyFilters';
import { isSortOnlyFilters } from './isSortOnlyFilters';

const TEST_CASES = [
  {
    description: 'a sort word alone is sort-only',
    given: { segment: 'sort=throughput' },
    expect: { output: true },
  },
  {
    description: 'a sort word beside floor is not sort-only',
    given: { segment: 'floor&sort=price' },
    expect: { output: false },
  },
  {
    description: 'a sort word beside a region is not sort-only',
    given: { segment: 'region=usa&sort=throughput' },
    expect: { output: false },
  },
  {
    description: 'a promise with no sort word is not sort-only',
    given: { segment: 'privacy=full' },
    expect: { output: false },
  },
];

describe('isSortOnlyFilters', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(
        isSortOnlyFilters({ filters: asSupplyFilters(thisCase.given) }),
      ).toEqual(thisCase.expect.output);
    }),
  );
});
