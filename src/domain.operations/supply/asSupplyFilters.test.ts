import { ConstraintError } from 'helpful-errors';
import { getError } from 'test-fns';

import { asSupplyFilters } from './asSupplyFilters';

const NONE = {
  floor: false,
  speedMinTps: null,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
};

const TEST_CASES_VALID = [
  {
    description: 'floor alone',
    given: { segment: 'floor' },
    expect: { ...NONE, floor: true },
  },
  {
    description: 'speed=min50tps form',
    given: { segment: 'floor&speed=min50tps' },
    expect: { ...NONE, floor: true, speedMinTps: 50 },
  },
  {
    description: 'speed.min=50tps form, same sense',
    given: { segment: 'floor&speed.min=50tps' },
    expect: { ...NONE, floor: true, speedMinTps: 50 },
  },
  {
    description: 'the agreed reviewer composite',
    given: { segment: 'floor&speed=min50tps&privacy=full' },
    expect: { ...NONE, floor: true, speedMinTps: 50, privacy: 'full' },
  },
  {
    description: 'the wish composite, any order',
    given: { segment: 'precision=fp8&region=usa&speed=min50tps&floor' },
    expect: {
      ...NONE,
      floor: true,
      speedMinTps: 50,
      region: 'usa',
      precision: 'fp8',
    },
  },
  {
    description: 'price.max with a decimal',
    given: { segment: 'price.max=0.5usd/M' },
    expect: { ...NONE, priceMaxUsdPerMillion: 0.5 },
  },
];

const TEST_CASES_INVALID = [
  { description: 'unknown word', given: { segment: 'cheap' } },
  { description: 'stray &', given: { segment: 'floor&' } },
  {
    description: 'both speed forms at once',
    given: { segment: 'speed=min50tps&speed.min=50tps' },
  },
  { description: 'speed without unit', given: { segment: 'speed=min50' } },
  {
    description: 'speed.min with the min prefix',
    given: { segment: 'speed.min=min50tps' },
  },
  { description: 'region other than usa', given: { segment: 'region=eu' } },
  {
    description: 'privacy other than full',
    given: { segment: 'privacy=some' },
  },
  { description: 'unknown precision', given: { segment: 'precision=fp9' } },
  { description: 'floor with a value', given: { segment: 'floor=yes' } },
];

describe('asSupplyFilters', () => {
  TEST_CASES_VALID.map((thisCase) =>
    test(`parses: ${thisCase.description}`, () => {
      expect(asSupplyFilters(thisCase.given)).toEqual(thisCase.expect);
    }),
  );

  TEST_CASES_INVALID.map((thisCase) =>
    test(`refuses: ${thisCase.description}`, async () => {
      const error = await getError(async () => asSupplyFilters(thisCase.given));
      expect(error).toBeInstanceOf(ConstraintError);
      expect(error.message).toContain('valid words');
      expect(error.message).toMatchSnapshot();
    }),
  );

  // .why = a word the grammar does not know must read as unknown, never as
  //        "absent value" — that would send the human to add a value to it
  test('names a word it does not know as unknown, beside known words', async () => {
    const error = await getError(async () =>
      asSupplyFilters({ segment: 'floor&cheap' }),
    );
    expect(error.message).toContain(
      "invalid openrouter supply filter 'cheap': unknown word",
    );
  });
});
