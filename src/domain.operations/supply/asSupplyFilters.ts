import { ConstraintError } from 'helpful-errors';

import { SUPPLY_SORTS, type SupplySort } from '../../domain.objects/SupplySort';

/**
 * .what = the supply promises a caller wrote in a slug's filter segment
 * .why = each word narrows which openrouter endpoints may serve the ask
 *
 * .note = each field is null when the caller did not write that word
 */
export type SupplyFilters = {
  floor: boolean;
  speedMinTps: number | null;
  region: 'usa' | null;
  precision: SupplyPrecision | null;
  privacy: 'full' | null;
  priceMaxUsdPerMillion: number | null;
  sort: SupplySort | null; // the order hosts are tried in; null = cheapest input first
};

export const SUPPLY_PRECISIONS = [
  'int4',
  'int8',
  'fp4',
  'fp6',
  'fp8',
  'fp16',
  'bf16',
  'fp32',
] as const;
export type SupplyPrecision = (typeof SUPPLY_PRECISIONS)[number];

/**
 * .what = each filter key as read (both speed spellings read as `speed`)
 * .why = a word whose key is not here is unknown, so the refusal says so
 */
const FILTER_KEYS = [
  'floor',
  'speed',
  'region',
  'precision',
  'privacy',
  'price.max',
  'sort',
] as const;

/**
 * .what = the filter segment a slug with no filters of its own is supplied by
 * .why = a bare slug takes our walk, never openrouter's balancer: the cheapest
 *        endpoint that serves at ≥ 50 tokens/sec and retains no data
 *
 * .note = a slug that writes its own promises replaces these whole; a segment of
 *         `sort` alone is parsed after them, so it orders hosts within them
 */
export const SUPPLY_FILTERS_DEFAULT_SEGMENT =
  'floor&speed=min50tps&privacy=full';

/**
 * .what = the filters of a segment that writes no word
 * .why = the seed every parse starts from, and the one shape "no promise" is
 *        compared to; a new field fails to compile here until it is named
 */
export const SUPPLY_FILTERS_NONE: SupplyFilters = {
  floor: false,
  speedMinTps: null,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
  sort: null,
};

const VALID_WORDS = [
  'floor',
  'speed=min{N}tps · speed.min={N}tps',
  'region=usa',
  `precision=${SUPPLY_PRECISIONS.join('|')}`,
  'privacy=full',
  'price.max={N}usd/M',
  `sort=${SUPPLY_SORTS.join('|')}   (latency: only without floor)`,
];

/**
 * .what = refuses one filter word with the valid set named
 * .why = a typo in a filter would bill a wrong host; name the fix
 */
const failOnWord = (
  input: { word: string; why: string },
  options?: { fix: string[] },
): never => {
  throw new ConstraintError(
    [
      `invalid openrouter supply filter '${input.word}': ${input.why}`,
      ...(options ? ['', ...options.fix] : []),
      '',
      `valid words, joined by '&' in any order:`,
      ...VALID_WORDS.map((word) => `  - ${word}`),
    ].join('\n'),
    { word: input.word },
  );
};

/**
 * .what = one filter word, split at its `=`: the key as written, the key as read, the value
 * .why = both speed spellings share one key (`speed.min` reads as `speed`); a
 *        word with a second `=` is malformed, so its count is kept
 */
const asFilterWordParts = (input: {
  word: string;
}): {
  keyWritten: string;
  key: string;
  value: string | undefined;
  equalsCount: number;
} => {
  const equalsAt = input.word.indexOf('=');
  const keyWritten =
    equalsAt === -1 ? input.word : input.word.slice(0, equalsAt);
  return {
    keyWritten,
    key: keyWritten === 'speed.min' ? 'speed' : keyWritten,
    value: equalsAt === -1 ? undefined : input.word.slice(equalsAt + 1),
    equalsCount: input.word.split('=').length - 1,
  };
};

/**
 * .what = a literal string, escaped for use inside a RegExp
 * .why = a prefix or suffix like `usd/M` must match as written, never as pattern
 */
const asRegexLiteral = (input: { text: string }): string =>
  input.text.replace(/[.*+?^${}()|[\]\\/]/g, (char) => `\\${char}`);

/**
 * .what = reads a number with a fixed prefix and suffix, e.g. `min50tps`
 * .why = both speed spellings and the price bound share this shape
 */
const asNumberBetween = (input: {
  word: string;
  value: string;
  prefix: string;
  suffix: string;
}): number => {
  // match `{prefix}{N}{suffix}`, N an integer or decimal
  const pattern = new RegExp(
    `^${asRegexLiteral({ text: input.prefix })}(\\d+(?:\\.\\d+)?)${asRegexLiteral({ text: input.suffix })}$`,
  );
  const found = pattern.exec(input.value)?.[1];
  if (!found)
    return failOnWord({
      word: input.word,
      why: `expected ${input.prefix}{N}${input.suffix}`,
    });
  return Number(found);
};

/**
 * .what = parses a slug's filter segment into supply promises
 * .why = the slug carries which hosts may supply the ask; a malformed
 *        word is refused here, before any network call
 *
 * .note = `speed=min50tps` and `speed.min=50tps` are two spellings of one sense
 *
 * .example
 *   asSupplyFilters({ segment: 'floor&speed=min50tps&privacy=full' })
 *   // { floor: true, speedMinTps: 50, privacy: 'full', ... }
 */
export const asSupplyFilters = (input: { segment: string }): SupplyFilters => {
  // split into words; an empty word is a stray '&'
  const words = input.segment.split('&');
  if (words.some((word) => word.length === 0))
    return failOnWord({ word: input.segment, why: "empty word (stray '&')" });

  // each key may appear once; both speed spellings share one key
  const keys = words.map((word) => asFilterWordParts({ word }).key);
  const keyTwice = keys.find((key, index) => keys.indexOf(key) !== index);
  if (keyTwice)
    return failOnWord({
      word: input.segment,
      why: `'${keyTwice}' written twice`,
    });

  // read each word onto its promise
  const filters = words.reduce<SupplyFilters>((acc, word) => {
    const { keyWritten, key, value, equalsCount } = asFilterWordParts({
      word,
    });
    if (equalsCount > 1) return failOnWord({ word, why: "more than one '='" });

    // a word this grammar does not know is named as such, never as a value gap
    if (!FILTER_KEYS.some((known) => known === key))
      return failOnWord({ word, why: 'unknown word' });

    if (key === 'floor' && value === undefined) return { ...acc, floor: true };
    if (value === undefined || value === '')
      return failOnWord({ word, why: 'absent value' });

    if (keyWritten === 'speed')
      return {
        ...acc,
        speedMinTps: asNumberBetween({
          word,
          value,
          prefix: 'min',
          suffix: 'tps',
        }),
      };
    if (keyWritten === 'speed.min')
      return {
        ...acc,
        speedMinTps: asNumberBetween({
          word,
          value,
          prefix: '',
          suffix: 'tps',
        }),
      };
    if (key === 'region' && value === 'usa') return { ...acc, region: 'usa' };
    if (key === 'privacy' && value === 'full')
      return { ...acc, privacy: 'full' };
    if (key === 'precision') {
      const precision = SUPPLY_PRECISIONS.find((p) => p === value);
      if (!precision) return failOnWord({ word, why: 'unknown precision' });
      return { ...acc, precision };
    }
    if (key === 'sort') {
      const sort = SUPPLY_SORTS.find((s) => s === value);
      if (!sort) return failOnWord({ word, why: 'unknown sort' });
      return { ...acc, sort };
    }
    if (key === 'price.max')
      return {
        ...acc,
        priceMaxUsdPerMillion: asNumberBetween({
          word,
          value,
          prefix: '',
          suffix: 'usd/M',
        }),
      };
    return failOnWord({ word, why: 'unknown word or value' });
  }, SUPPLY_FILTERS_NONE);

  // the floor walk orders hosts itself, and reads no per-host latency figure yet
  if (filters.floor && filters.sort === 'latency')
    return failOnWord(
      {
        word: 'sort=latency',
        why: 'the floor walk cannot order by latency',
      },
      {
        fix: [
          'fix: let openrouter order by latency, with no floor —',
          '  …/privacy=full&sort=latency   (a sort word alone keeps the default floor, so name a filter word)',
          'or keep the floor, ordered by throughput —',
          '  …/floor&sort=throughput',
        ],
      },
    );
  return filters;
};
