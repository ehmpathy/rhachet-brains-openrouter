import { getError } from 'test-fns';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplyFilters } from './asSupplyFilters';
import { getAllQualifiedEndpoints } from './getAllQualifiedEndpoints';

const MODEL = 'deepseek/deepseek-v4.1-flash';

/**
 * .what = an endpoint fixture, shaped after the 2026-10-01 live read
 * .why = each case varies only the field it is about
 */
const genEndpoint = (input: {
  tag: string;
  promptPerMillion: number;
  completionPerMillion: number;
  tps: number | null;
  params: string[];
  zdr?: boolean;
  maxCompletionTokens?: number | null;
}): OpenRouterEndpoint => ({
  providerName: input.tag,
  tag: input.tag,
  quantization: 'fp8',
  supportedParameters: input.params,
  pricePromptUsdPerToken: input.promptPerMillion / 1e6,
  priceCompletionUsdPerToken: input.completionPerMillion / 1e6,
  throughputTps: input.tps,
  maxCompletionTokens: input.maxCompletionTokens ?? null,
  zdr: input.zdr ?? true,
});

// cheap input, dear output, no response_format — relace's shape
const endpointInputCheap = genEndpoint({
  tag: 'relace',
  promptPerMillion: 0.03,
  completionPerMillion: 0.6,
  tps: 71,
  params: ['tools'],
});

// dear input, cheap output, with response_format
const endpointOutputCheap = genEndpoint({
  tag: 'dekallm',
  promptPerMillion: 0.2,
  completionPerMillion: 0.1,
  tps: 60,
  params: ['tools', 'response_format'],
});

// cheapest of all, but slow
const endpointSlow = genEndpoint({
  tag: 'crawl',
  promptPerMillion: 0.01,
  completionPerMillion: 0.01,
  tps: 12,
  params: ['tools', 'response_format'],
});

const FILTERS_FLOOR: SupplyFilters = {
  floor: true,
  speedMinTps: 50,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
  sort: null,
};

const ENDPOINTS = [endpointInputCheap, endpointOutputCheap, endpointSlow];

describe('getAllQualifiedEndpoints', () => {
  const TEST_CASES = [
    {
      description: 'a text ask heads with the cheapest-input endpoint',
      given: { paramsRequired: [], tokens: { input: 22000 } },
      expect: { head: 'relace' },
    },
    {
      description:
        'a short ask still heads with the cheapest-input endpoint — the output rate never moves the rank',
      given: { paramsRequired: [], tokens: { input: 10 } },
      expect: { head: 'relace' },
    },
    {
      description:
        'a schema ask drops the endpoint without response_format before the rank',
      given: {
        paramsRequired: ['response_format'],
        tokens: { input: 22000 },
      },
      expect: { head: 'dekallm' },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const result = getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: null,
        endpoints: ENDPOINTS,
        filters: FILTERS_FLOOR,
        paramsRequired: thisCase.given.paramsRequired,
        tokens: thisCase.given.tokens,
      });
      expect(result.qualified[0]?.tag).toEqual(thisCase.expect.head);
      expect(result.qualified.map((e) => e.tag)).not.toContain('crawl');
    }),
  );

  // .why = case=4: a lane that races a deadline buys the fastest qualified host first
  test('sort=throughput tries the fastest qualified host first, and still keeps every promise', () => {
    const hostA = genEndpoint({
      tag: 'a-cheap',
      promptPerMillion: 0.03,
      completionPerMillion: 0.1,
      tps: 60,
      params: [],
    });
    const hostB = genEndpoint({
      tag: 'b-mid',
      promptPerMillion: 0.06,
      completionPerMillion: 0.1,
      tps: 180,
      params: [],
    });
    const hostC = genEndpoint({
      tag: 'c-dear',
      promptPerMillion: 0.09,
      completionPerMillion: 0.1,
      tps: 120,
      params: [],
    });
    const given = {
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints: [hostA, hostB, hostC, endpointSlow],
      paramsRequired: [],
      tokens: { input: 22000 },
    };
    const sorted = getAllQualifiedEndpoints({
      ...given,
      filters: { ...FILTERS_FLOOR, sort: 'throughput' },
    });
    expect(sorted.qualified.map((e) => e.tag)).toEqual([
      'b-mid',
      'c-dear',
      'a-cheap',
    ]);
    const unsorted = getAllQualifiedEndpoints({
      ...given,
      filters: FILTERS_FLOOR,
    });
    expect(unsorted.qualified.map((e) => e.tag)).toEqual([
      'a-cheap',
      'b-mid',
      'c-dear',
    ]);
  });

  test('an endpoint with no rate never heads the floor', () => {
    const endpointUnpriced = genEndpoint({
      tag: 'unpriced',
      promptPerMillion: Number.NaN,
      completionPerMillion: Number.NaN,
      tps: 90,
      params: ['tools', 'response_format'],
    });
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints: [endpointUnpriced, endpointOutputCheap, endpointInputCheap],
      filters: FILTERS_FLOOR,
      paramsRequired: [],
      tokens: { input: 22000 },
    });
    expect(result.qualified.map((e) => e.tag)).toEqual([
      'relace',
      'dekallm',
      'unpriced',
    ]);
  });

  test('among endpoints of equal cost, the fastest heads the floor', () => {
    const endpointTwinSlow = genEndpoint({
      tag: 'twin-slow',
      promptPerMillion: 0.1,
      completionPerMillion: 0.1,
      tps: 55,
      params: [],
    });
    const endpointTwinFast = genEndpoint({
      tag: 'twin-fast',
      promptPerMillion: 0.1,
      completionPerMillion: 0.1,
      tps: 95,
      params: [],
    });
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints: [endpointTwinSlow, endpointTwinFast],
      filters: FILTERS_FLOOR,
      paramsRequired: [],
      tokens: { input: 1000 },
    });
    expect(result.qualified.map((e) => e.tag)).toEqual([
      'twin-fast',
      'twin-slow',
    ]);
  });

  test('privacy=full keeps only zdr endpoints, and names the cheaper one it dropped', () => {
    const endpointRetains = genEndpoint({
      tag: 'retains',
      promptPerMillion: 0.001,
      completionPerMillion: 0.001,
      tps: 90,
      params: [],
      zdr: false,
    });
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints: [endpointRetains, endpointInputCheap],
      filters: { ...FILTERS_FLOOR, privacy: 'full' },
      paramsRequired: [],
      tokens: { input: 1000 },
    });
    expect(result.qualified.map((e) => e.tag)).toEqual(['relace']);
    expect(
      result.verdicts.find((v) => v.endpoint.tag === 'retains')?.failed,
    ).toEqual('privacy=full (zdr list)');
  });

  test('region=usa keeps only usa-region tags, never a base tag', () => {
    // .why = a provider's domicile is not its datacenter (forbidden cell)
    const endpoints = [
      'deepinfra',
      'deepinfra/us',
      'acme/us-east',
      'acme/eu',
      'acme/usa', // .why = an unpublished form; not assumed to be the us region (F1)
      'acme/user', // .why = a part that merely starts with "us" is not a region
    ].map((tag) =>
      genEndpoint({
        tag,
        promptPerMillion: 0.1,
        completionPerMillion: 0.1,
        tps: 90,
        params: [],
      }),
    );
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints,
      filters: { ...FILTERS_FLOOR, region: 'usa' },
      paramsRequired: [],
      tokens: { input: 1000 },
    });
    expect(result.qualified.map((e) => e.tag).sort()).toEqual([
      'acme/us-east',
      'deepinfra/us',
    ]);
    expect(
      result.verdicts.find((v) => v.endpoint.tag === 'deepinfra')?.failed,
    ).toEqual('region=usa');
  });

  test('precision keeps only endpoints that serve that quantization', () => {
    const endpointFp4 = {
      ...genEndpoint({
        tag: 'fp4-host',
        promptPerMillion: 0.001,
        completionPerMillion: 0.001,
        tps: 90,
        params: [],
      }),
      quantization: 'fp4',
    };
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints: [endpointFp4, endpointInputCheap],
      filters: { ...FILTERS_FLOOR, precision: 'fp8' },
      paramsRequired: [],
      tokens: { input: 1000 },
    });
    expect(result.qualified.map((e) => e.tag)).toEqual(['relace']);
    expect(
      result.verdicts.find((v) => v.endpoint.tag === 'fp4-host')?.failed,
    ).toEqual('precision=fp8');
  });

  test('price.max drops an endpoint above the bound on either rate', () => {
    // .why = relace's input is under the bound, its output is over it
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints: [endpointInputCheap, endpointOutputCheap],
      filters: { ...FILTERS_FLOOR, priceMaxUsdPerMillion: 0.5 },
      paramsRequired: [],
      tokens: { input: 1000 },
    });
    expect(result.qualified.map((e) => e.tag)).toEqual(['dekallm']);
    expect(
      result.verdicts.find((v) => v.endpoint.tag === 'relace')?.failed,
    ).toEqual('price.max=0.5usd/M');
  });

  test('every cheaper loser names the promise it failed', () => {
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: null,
      endpoints: ENDPOINTS,
      filters: FILTERS_FLOOR,
      paramsRequired: ['response_format'],
      tokens: { input: 22000 },
    });
    const verdictOf = (tag: string) =>
      result.verdicts.find((v) => v.endpoint.tag === tag)?.failed;
    expect(verdictOf('crawl')).toEqual('speed>=50tps');
    expect(verdictOf('relace')).toEqual('supports(response_format)');
    expect(verdictOf('dekallm')).toBeNull();
  });

  // .why = measured 2026-10-02: a host that lists the schema params can still
  //        answer prose; once seen, a json ask must not send to it again
  test('a host this machine saw answer prose is skipped, and names the step', () => {
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: ['dekallm'],
      tokensThoughtBudget: null,
      endpoints: [endpointOutputCheap, endpointSlow],
      filters: { ...FILTERS_FLOOR, speedMinTps: null },
      paramsRequired: ['response_format'],
      tokens: { input: 1000 },
    });
    expect(result.qualified.map((e) => e.tag)).toEqual(['crawl']);
    expect(
      result.verdicts.find((v) => v.endpoint.tag === 'dekallm')?.failed,
    ).toEqual('honors(json) — no prose or 0-char reply seen, 7d');
    expect(result.funnel.map((f) => f.promise)).toContain(
      'honors(json) — no prose or 0-char reply seen, 7d',
    );
  });

  test('a json-memory step that empties the set names the z.string() fix', async () => {
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: ['dekallm'],
        tokensThoughtBudget: null,
        endpoints: [endpointOutputCheap],
        filters: FILTERS_FLOOR,
        paramsRequired: ['response_format'],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain('0 ← honors(json)');
    expect(error.message).toContain(
      'answered prose or 0 chars on this machine',
    );
    expect(error.message).toMatchSnapshot();
  });

  test('a schema step that empties the set names the z.string() fix', async () => {
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: null,
        endpoints: [endpointInputCheap],
        filters: FILTERS_FLOOR,
        paramsRequired: ['response_format'],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain('0 ← supports(response_format)');
    expect(error.message).toContain('z.string()');
    expect(error.message).toMatchSnapshot();
  });

  test('a tools step that empties the set names the drop-the-param fix', async () => {
    const endpointToolless = genEndpoint({
      tag: 'toolless',
      promptPerMillion: 0.1,
      completionPerMillion: 0.1,
      tps: 90,
      params: ['response_format'],
    });
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: null,
        endpoints: [endpointToolless],
        filters: FILTERS_FLOOR,
        paramsRequired: ['tools'],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain('0 ← supports(tools)');
    expect(error.message).toContain('drop that param from the ask');
    expect(error.message).not.toContain('z.string()');
    expect(error.message).toMatchSnapshot();
  });

  test('a filter step that empties the set names the slug fix', async () => {
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: null,
        endpoints: [endpointSlow],
        filters: FILTERS_FLOOR,
        paramsRequired: [],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain('0 ← speed>=50tps');
    expect(error.message).toContain('drop or loosen the promise');
    expect(error.message).not.toContain('z.string()');
  });

  test('a refusal names each endpoint, its input rate, and the promise it fails (case=4)', async () => {
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: null,
        endpoints: ENDPOINTS,
        filters: { ...FILTERS_FLOOR, speedMinTps: 500 },
        paramsRequired: [],
        tokens: { input: 100 },
      }),
    );
    const rows = error.message
      .split('\n')
      .filter((line) => line.includes(' ✗ '));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('$0.01/M');
    expect(rows[0]).toContain('crawl');
    expect(rows[0]).toContain('speed>=500tps');
    expect(rows[2]).toContain('dekallm');
    expect(error.message).toMatchSnapshot();
  });

  test('a refusal under sort=throughput names its rows fastest first', async () => {
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: null,
        endpoints: ENDPOINTS,
        filters: { ...FILTERS_FLOOR, speedMinTps: 500, sort: 'throughput' },
        paramsRequired: [],
        tokens: { input: 100 },
      }),
    );
    const rows = error.message
      .split('\n')
      .filter((line) => line.includes(' ✗ '));
    expect(error.message).toContain(
      'each endpoint, fastest first, and the promise it fails:',
    );
    expect(error.message).not.toContain('cheapest input rate first');
    expect(rows[0]).not.toContain('crawl');
    expect(error.message).toMatchSnapshot();
  });

  // .why = q6: a budget at or past a host's output limit leaves no room to answer; refuse before spend
  test('a thought budget at or past a host output limit drops that host; an unlisted limit stays', () => {
    const hostRoomy = genEndpoint({
      tag: 'roomy',
      promptPerMillion: 0.05,
      completionPerMillion: 0.1,
      tps: 90,
      params: [],
      maxCompletionTokens: 384_000,
    });
    const hostTight = genEndpoint({
      tag: 'tight',
      promptPerMillion: 0.02,
      completionPerMillion: 0.1,
      tps: 90,
      params: [],
      maxCompletionTokens: 8_000,
    });
    const hostUnlisted = genEndpoint({
      tag: 'unlisted',
      promptPerMillion: 0.04,
      completionPerMillion: 0.1,
      tps: 90,
      params: [],
    });
    const result = getAllQualifiedEndpoints({
      model: MODEL,
      tagsJsonIgnored: [],
      tokensThoughtBudget: 8_000,
      endpoints: [hostRoomy, hostTight, hostUnlisted],
      filters: FILTERS_FLOOR,
      paramsRequired: [],
      tokens: { input: 100 },
    });
    expect(result.qualified.map((e) => e.tag)).toEqual(['unlisted', 'roomy']);
    expect(
      result.verdicts.find((v) => v.endpoint.tag === 'tight')?.failed,
    ).toEqual('thought<output.max (budget 8,000 tokens)');
  });

  // .why = the number must be one a host could serve: a roomier host that lacks a param the
  //        ask needs is dropped before the thought step, so it must never set the number
  test('a thought-limit fix names the limit of a host that lists every needed param', async () => {
    const hostTight = genEndpoint({
      tag: 'tight',
      promptPerMillion: 0.02,
      completionPerMillion: 0.1,
      tps: 90,
      params: ['response_format'],
      maxCompletionTokens: 8_000,
    });
    const hostRoomyNoJson = genEndpoint({
      tag: 'roomy-nojson',
      promptPerMillion: 0.03,
      completionPerMillion: 0.1,
      tps: 90,
      params: [],
      maxCompletionTokens: 900_000,
    });
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: 9_000,
        endpoints: [hostTight, hostRoomyNoJson],
        filters: FILTERS_FLOOR,
        paramsRequired: ['response_format'],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain(
      '0 ← thought<output.max (budget 9,000 tokens)',
    );
    expect(error.message).toContain('lower effort.budget.tokens below 8,000');
    expect(error.message).not.toContain('900000');
  });

  test('a thought-limit step that empties the set names a lower budget', async () => {
    const hostTight = genEndpoint({
      tag: 'tight',
      promptPerMillion: 0.02,
      completionPerMillion: 0.1,
      tps: 90,
      params: [],
      maxCompletionTokens: 8_000,
    });
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: 9_000,
        endpoints: [hostTight],
        filters: FILTERS_FLOOR,
        paramsRequired: [],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain(
      '0 ← thought<output.max (budget 9,000 tokens)',
    );
    expect(error.message).toContain('lower effort.budget.tokens below 8,000'); // the fix names the number, never a guess
    expect(error.message).toMatchSnapshot();
  });

  // .why = case=6: a model whose hosts list no reasoning param, asked with an effort
  test('a reasoning step that empties the set names the drop-the-effort fix (case=6)', async () => {
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: 4_000,
        endpoints: [endpointOutputCheap],
        filters: FILTERS_FLOOR,
        paramsRequired: ['reasoning'],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain('0 ← supports(reasoning)');
    expect(error.message).toContain('drop the effort from the ask');
    expect(error.message).toContain('no call was sent');
    expect(error.message).toMatchSnapshot();
  });

  // .why = bhrain's main shape: a json-schema ask with an effort, on hosts that honor json but list no reasoning
  test('a json ask with an effort, on hosts with json and no reasoning, names the reasoning step, never the json one', async () => {
    const error = await getError(async () =>
      getAllQualifiedEndpoints({
        model: MODEL,
        tagsJsonIgnored: [],
        tokensThoughtBudget: 4_000,
        endpoints: [endpointOutputCheap],
        filters: FILTERS_FLOOR,
        paramsRequired: ['response_format', 'reasoning'],
        tokens: { input: 100 },
      }),
    );
    expect(error.message).toContain('1 ← supports(response_format)');
    expect(error.message).toContain('0 ← supports(reasoning)');
    expect(error.message).toContain('drop the effort from the ask');
    expect(error.message).not.toContain('ask for a z.string() reply');
    expect(error.message).toMatchSnapshot();
  });
});
