import { MalfunctionError } from 'helpful-errors';
import type OpenAI from 'openai';
import { getError } from 'test-fns';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asSupplyFilters } from './asSupplyFilters';
import { getOneSuppliedCompletion } from './getOneSuppliedCompletion';

/**
 * .what = a fake openai client that records each request it receives
 * .why = the supply's only contract with openai is the request it sends; no network
 *
 * .note = the cast stands in for the full client; only `chat.completions.create`
 *         is reached. removal: when the context declares that one method as its
 *         own structural type, the fake satisfies it with no cast
 */
const genOpenAiFake = (input: {
  provider: string | null;
  finishReason?: string | null;
  content?: string;
}) => {
  const requests: Record<string, unknown>[] = [];
  const openai = {
    chat: {
      completions: {
        create: async (request: Record<string, unknown>) => {
          requests.push(request);
          return {
            id: 'gen-fake',
            ...(input.provider === null ? {} : { provider: input.provider }),
            usage: { cost: 0.00001 },
            choices: [
              {
                index: 0,
                finish_reason:
                  input.finishReason === undefined
                    ? 'stop'
                    : input.finishReason,
                message: {
                  role: 'assistant',
                  content: input.content ?? '{"ok":true}',
                },
              },
            ],
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { openai, requests };
};

/**
 * .what = a fake endpoint, shaped as the sdk returns it
 * .why = the filtered paths read only these fields
 */
const genEndpoint = (input: {
  tag: string;
  providerName: string;
  pricePerMillion: number;
}): OpenRouterEndpoint => ({
  providerName: input.providerName,
  tag: input.tag,
  quantization: 'fp8',
  supportedParameters: ['response_format', 'tools'],
  pricePromptUsdPerToken: input.pricePerMillion / 1e6,
  priceCompletionUsdPerToken: input.pricePerMillion / 1e6,
  throughputTps: 90,
  zdr: true,
});

const ENDPOINTS = [
  genEndpoint({ tag: 'cheap', providerName: 'Cheap', pricePerMillion: 0.1 }),
  genEndpoint({ tag: 'dear', providerName: 'Dear', pricePerMillion: 0.9 }),
];

/**
 * .what = a fake sdk that serves a fixed endpoint list
 * .why = with the sdk injected, the filtered paths run with no network
 */
const genSdkFake = (input?: { tagsJsonIgnored: string[] }) => {
  const reads: string[][] = [];
  return {
    reads,
    getAllForModel: async () => ENDPOINTS,
    delForModel: async () => undefined,
    getAllJsonIgnoredTags: async (query: { model: string; tags: string[] }) => {
      reads.push(query.tags);
      return (input?.tagsJsonIgnored ?? []).filter((tag) =>
        query.tags.includes(tag),
      );
    },
    setJsonIgnoredTag: async () => undefined,
  };
};

const REQUEST = {
  model: 'deepseek/deepseek-v4.1-flash',
  messages: [{ role: 'user' as const, content: 'hi' }],
};

describe('getOneSuppliedCompletion', () => {
  // 🔴 .why = F31: a host this machine saw answer prose must not be sent a json
  //           ask again within 7 days
  test('a json ask skips each host this machine remembers as json-ignored', async () => {
    const { openai, requests } = genOpenAiFake({ provider: 'Dear' });
    const sdk = genSdkFake({ tagsJsonIgnored: ['cheap'] });
    const result = await getOneSuppliedCompletion(
      {
        apiKey: 'fake',
        model: REQUEST.model,
        request: REQUEST,
        filters: asSupplyFilters({ segment: 'floor' }),
        paramsRequired: ['response_format'],
        expectsJson: true,
      },
      { openai, sdkOpenRouterEndpoints: sdk },
    );
    expect(sdk.reads).toEqual([['cheap', 'dear']]);
    expect(requests[0]?.provider).toMatchObject({ only: ['dear'] });
    expect(result.supply.choice?.funnel.map((f) => f.promise)).toContain(
      'honors(json) — not seen in prose, 7d',
    );
  });

  test('a plain ask never reads the json memory', async () => {
    const { openai, requests } = genOpenAiFake({
      provider: 'Cheap',
      content: 'hi',
    });
    const sdk = genSdkFake({ tagsJsonIgnored: ['cheap'] });
    await getOneSuppliedCompletion(
      {
        apiKey: 'fake',
        model: REQUEST.model,
        request: REQUEST,
        filters: asSupplyFilters({ segment: 'floor' }),
        paramsRequired: [],
        expectsJson: false,
      },
      { openai, sdkOpenRouterEndpoints: sdk },
    );
    expect(sdk.reads).toEqual([]);
    expect(requests[0]?.provider).toMatchObject({ only: ['cheap'] });
  });

  test('a filtered ask with no floor admits the whole qualified set at once', async () => {
    const { openai, requests } = genOpenAiFake({ provider: 'Dear' });
    const result = await getOneSuppliedCompletion(
      {
        apiKey: 'fake',
        model: REQUEST.model,
        request: REQUEST,
        filters: asSupplyFilters({ segment: 'privacy=full' }),
        paramsRequired: [],
        expectsJson: false,
      },
      { openai, sdkOpenRouterEndpoints: genSdkFake() },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.provider).toMatchObject({
      only: ['cheap', 'dear'],
      allow_fallbacks: false,
      zdr: true,
    });
    expect(result.supply.attempts).toEqual([]);
    expect(result.supply.choice?.ranked.map((row) => row.tag)).toEqual([
      'cheap',
      'dear',
    ]);
  });

  test('a floor ask admits the cheapest qualified endpoint alone', async () => {
    const { openai, requests } = genOpenAiFake({ provider: 'Cheap' });
    const result = await getOneSuppliedCompletion(
      {
        apiKey: 'fake',
        model: REQUEST.model,
        request: REQUEST,
        filters: asSupplyFilters({ segment: 'floor' }),
        paramsRequired: [],
        expectsJson: false,
      },
      { openai, sdkOpenRouterEndpoints: genSdkFake() },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.provider).toMatchObject({ only: ['cheap'] });
    expect(result.supply.attempts).toEqual([
      { tag: 'cheap', outcome: 'served' },
    ]);
  });

  // 🔴 .why = i002: a spread of the reply's extras leaked `errorMessage` into the
  //           report a caller reads. the report holds exactly `SupplyReport`
  //           the charge lives in metrics, so `costUsd` is absent here too
  const SUPPLY_KEYS = ['attempts', 'choice', 'generationId', 'provider'];
  [
    { description: 'floor', filters: asSupplyFilters({ segment: 'floor' }) },
    {
      description: 'admitted-set',
      filters: asSupplyFilters({ segment: 'privacy=full' }),
    },
  ].map((thisCase) =>
    test(`a ${thisCase.description} ask reports exactly the SupplyReport keys`, async () => {
      const { openai } = genOpenAiFake({ provider: 'Cheap' });
      const result = await getOneSuppliedCompletion(
        {
          apiKey: 'fake',
          model: REQUEST.model,
          request: REQUEST,
          filters: thisCase.filters,
          paramsRequired: [],
          expectsJson: false,
        },
        { openai, sdkOpenRouterEndpoints: genSdkFake() },
      );
      expect(Object.keys(result.supply).sort()).toEqual(SUPPLY_KEYS);
    }),
  );

  // 🔴 .why = measured 2026-10-02: three review lanes, on a floor slug, failed
  //           with "openrouter served from 'null'". the reply was unfit to read,
  //           and the admit check misread its absent provider as a breach. the
  //           reply defect must be named first, on the filtered path too
  // .note = these run on the admitted-set path; the floor walk steps past a host
  //         that failed mid-reply instead (F26, getOneFloorCompletion case6)
  const TEST_CASES_DEFECT = [
    {
      description:
        'a failed reply with no provider is named as a failed reply, never an admit breach',
      given: { provider: null, finishReason: 'error', content: '' },
      expect: { contains: 'no usable reply' },
    },
    {
      description:
        'an empty reply where json is owed is named, never parsed as json',
      given: { provider: 'Cheap', finishReason: 'stop', content: '' },
      expect: { contains: 'no usable reply' },
    },
    {
      description: 'a reply cut at the output limit is named, never trusted',
      given: { provider: 'Cheap', finishReason: 'length', content: '{"ok":' },
      expect: { contains: 'cut off at the output limit' },
    },
  ];

  TEST_CASES_DEFECT.map((thisCase) =>
    test(thisCase.description, async () => {
      const { openai } = genOpenAiFake(thisCase.given);
      const error = await getError(
        getOneSuppliedCompletion(
          {
            apiKey: 'fake',
            model: REQUEST.model,
            request: REQUEST,
            filters: asSupplyFilters({ segment: 'privacy=full' }),
            paramsRequired: ['response_format'],
            expectsJson: true,
          },
          { openai, sdkOpenRouterEndpoints: genSdkFake() },
        ),
      );
      expect(error).toBeInstanceOf(MalfunctionError);
      expect(error.message).toContain(thisCase.expect.contains);
      expect(error.message).not.toContain('served from');
    }),
  );
});
