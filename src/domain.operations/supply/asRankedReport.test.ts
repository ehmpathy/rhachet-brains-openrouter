import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asRankedReport } from './asRankedReport';

const genVerdict = (input: {
  tag: string;
  failed: string | null;
  tps?: number;
}) => ({
  endpoint: {
    providerName: input.tag,
    tag: input.tag,
    quantization: null,
    supportedParameters: [],
    pricePromptUsdPerToken: 0.00000003,
    priceCompletionUsdPerToken: 0.0000005,
    throughputTps: input.tps ?? 80,
    zdr: true,
  } satisfies OpenRouterEndpoint,
  estUsd: 0.0000123456,
  failed: input.failed,
});

const VERDICTS = [
  // .note = the loser's tps matches the promise it failed, so a row reads true
  genVerdict({ tag: 'a', failed: 'speed 12tps < min 50tps', tps: 12 }),
  genVerdict({ tag: 'b', failed: null }),
  genVerdict({ tag: 'c', failed: null }),
  genVerdict({ tag: 'd', failed: null }),
  genVerdict({ tag: 'e', failed: null }),
  genVerdict({ tag: 'f', failed: null }),
];

describe('asRankedReport', () => {
  const TEST_CASES = [
    {
      description: 'it keeps every row through the winner, and three past it',
      given: { servedTag: 'b' },
      expect: { tags: ['a', 'b', 'c', 'd', 'e'] },
    },
    {
      description: 'a winner near the tail keeps all rows to the end',
      given: { servedTag: 'e' },
      expect: { tags: ['a', 'b', 'c', 'd', 'e', 'f'] },
    },
    {
      description: 'a winner absent from the verdicts keeps the head',
      given: { servedTag: 'zz' },
      expect: { tags: ['a', 'b', 'c', 'd'] },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const ranked = asRankedReport({
        verdicts: VERDICTS,
        servedTag: thisCase.given.servedTag,
      });
      expect(ranked.map((row) => row.tag)).toEqual(thisCase.expect.tags);
    }),
  );

  test('the ranked rows a caller audits match snapshot', () => {
    // .why = the live supply snapshot masks these rows; here they are exact
    expect(
      asRankedReport({ verdicts: VERDICTS, servedTag: 'b' }),
    ).toMatchSnapshot();
  });

  test('each row names its failed promise, or reads qualified', () => {
    const [loser, winner] = asRankedReport({
      verdicts: VERDICTS,
      servedTag: 'b',
    });
    expect(loser?.verdict).toEqual('speed 12tps < min 50tps');
    expect(winner?.verdict).toEqual('qualified');
  });

  test('the estimate is rounded to three significant figures', () => {
    const [row] = asRankedReport({ verdicts: VERDICTS, servedTag: 'b' });
    expect(row?.estUsd).toEqual(0.0000123);
  });
});
