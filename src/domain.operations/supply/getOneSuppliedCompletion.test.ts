import { MalfunctionError } from 'helpful-errors';
import OpenAI from 'openai';
import { getError, given, then, useThen, when } from 'test-fns';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { getOneAskErrorNamed } from '../atom/getOneAskErrorNamed';
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
  tps?: number;
  params?: string[];
}): OpenRouterEndpoint => ({
  providerName: input.providerName,
  tag: input.tag,
  quantization: 'fp8',
  supportedParameters: input.params ?? ['response_format', 'tools'],
  pricePromptUsdPerToken: input.pricePerMillion / 1e6,
  priceCompletionUsdPerToken: input.pricePerMillion / 1e6,
  throughputTps: input.tps ?? 90,
  maxCompletionTokens: null,
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
const genSdkFake = (input?: {
  tagsJsonIgnored?: string[];
  endpoints?: OpenRouterEndpoint[];
}) => {
  const reads: string[][] = [];
  return {
    reads,
    getAllForModel: async () => input?.endpoints ?? ENDPOINTS,
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
        reasoning: null,
        expectsJson: true,
      },
      { openai, sdkOpenRouterEndpoints: sdk },
    );
    expect(sdk.reads).toEqual([['cheap', 'dear']]);
    expect(requests[0]?.provider).toMatchObject({ only: ['dear'] });
    expect(result.supply.choice?.funnel.map((f) => f.promise)).toContain(
      'honors(json) — no prose or 0-char reply seen, 7d',
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
        reasoning: null,
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
        reasoning: null,
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
    expect(result.supply.attempts).toEqual([
      { tag: 'dear', outcome: 'served' },
    ]); // the last attempt served, in both supply modes
    expect(result.supply.choice?.ranked.map((row) => row.tag)).toEqual([
      'cheap',
      'dear',
    ]);
    expect(result.supply).toMatchSnapshot(); // the report a caller audits, first-try serve, no floor
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
        reasoning: null,
        expectsJson: false,
      },
      { openai, sdkOpenRouterEndpoints: genSdkFake() },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.provider).toMatchObject({ only: ['cheap'] });
    expect(result.supply.attempts).toEqual([
      { tag: 'cheap', outcome: 'served' },
    ]);
    expect(result.supply).toMatchSnapshot(); // the report a caller audits, first-try serve, floor
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
          reasoning: null,
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
            reasoning: null,
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

  // .why = case=2 [t1]: an all-thought reply on a floor walk is no host failure, so
  //        the walk sends one call, never a second host to spend the same thought again
  test('a floor walk that meets an all-thought reply sends one call, then names it', async () => {
    const { openai, requests } = genOpenAiFake({
      provider: 'Cheap',
      finishReason: 'length',
      content: '',
    });
    const error = await getError(
      getOneSuppliedCompletion(
        {
          apiKey: 'fake',
          model: REQUEST.model,
          request: REQUEST,
          filters: asSupplyFilters({ segment: 'floor' }),
          paramsRequired: ['response_format'],
          reasoning: null,
          expectsJson: true,
        },
        { openai, sdkOpenRouterEndpoints: genSdkFake() },
      ),
    );
    expect(requests).toHaveLength(1);
    expect(error).toBeInstanceOf(MalfunctionError);
    expect(error.message).toContain('spent the whole reply on thought');
    expect(
      error instanceof MalfunctionError ? error.metadata?.defect : null,
    ).toEqual('all-thought');
  });

  // .why = case=3: under `sort=throughput` the floor walk admits the fastest qualified
  //        host first, and openrouter is told the same sort
  test('a floor walk under sort=throughput admits the fastest host first', async () => {
    const { openai, requests } = genOpenAiFake({ provider: 'Quick' });
    const result = await getOneSuppliedCompletion(
      {
        apiKey: 'fake',
        model: REQUEST.model,
        request: REQUEST,
        filters: asSupplyFilters({ segment: 'floor&sort=throughput' }),
        paramsRequired: [],
        reasoning: null,
        expectsJson: false,
      },
      {
        openai,
        sdkOpenRouterEndpoints: genSdkFake({
          endpoints: [
            genEndpoint({
              tag: 'cheap',
              providerName: 'Cheap',
              pricePerMillion: 0.1,
              tps: 40,
            }),
            genEndpoint({
              tag: 'quick',
              providerName: 'Quick',
              pricePerMillion: 0.9,
              tps: 200,
            }),
          ],
        }),
      },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.provider).toMatchObject({
      only: ['quick'],
      sort: 'throughput',
    });
    expect(result.supply.attempts).toEqual([
      { tag: 'quick', outcome: 'served' },
    ]);
  });

  // .why = the cap arrives once: the supply adds it to the body and requires the
  //        param itself, so no caller can pass a cap whose `supports(reasoning)` drops
  test('a thought cap reaches the body and admits only a host that lists reasoning', async () => {
    const { openai, requests } = genOpenAiFake({ provider: 'Dear' });
    const result = await getOneSuppliedCompletion(
      {
        apiKey: 'fake',
        model: REQUEST.model,
        request: REQUEST,
        filters: asSupplyFilters({ segment: 'floor' }),
        paramsRequired: [],
        reasoning: { max_tokens: 600 },
        expectsJson: false,
      },
      {
        openai,
        sdkOpenRouterEndpoints: genSdkFake({
          endpoints: [
            genEndpoint({
              tag: 'cheap',
              providerName: 'Cheap',
              pricePerMillion: 0.1,
            }),
            genEndpoint({
              tag: 'dear',
              providerName: 'Dear',
              pricePerMillion: 0.9,
              params: ['response_format', 'tools', 'reasoning'],
            }),
          ],
        }),
      },
    );
    expect(requests[0]?.reasoning).toEqual({ max_tokens: 600 });
    expect(requests[0]?.provider).toMatchObject({ only: ['dear'] });
    expect(result.supply.choice?.funnel.map((f) => f.promise)).toContain(
      'supports(reasoning)',
    );
  });

  test('no thought cap sends no reasoning key', async () => {
    const { openai, requests } = genOpenAiFake({ provider: 'Cheap' });
    await getOneSuppliedCompletion(
      {
        apiKey: 'fake',
        model: REQUEST.model,
        request: REQUEST,
        filters: asSupplyFilters({ segment: 'floor' }),
        paramsRequired: [],
        reasoning: null,
        expectsJson: false,
      },
      { openai, sdkOpenRouterEndpoints: genSdkFake() },
    );
    expect('reasoning' in (requests[0] ?? {})).toEqual(false);
  });

  // .why = "an unset ask sends the 0.1.3 body" is pinned whole, not by key absence alone;
  //        one snap per option shows exactly what each adds
  const TEST_CASES_BODY = [
    { description: 'unset', segment: 'floor', reasoning: null },
    {
      description: 'a budget',
      segment: 'floor',
      reasoning: { max_tokens: 600 },
    },
    { description: 'a level', segment: 'floor', reasoning: { effort: 'low' } },
    {
      description: 'a sort',
      segment: 'floor&sort=throughput',
      reasoning: null,
    },
    {
      description: 'a sort by price',
      segment: 'floor&sort=price',
      reasoning: null,
    },
    {
      description: 'a sort by throughput, no floor (fallbacks inside only)',
      segment: 'privacy=full&sort=throughput',
      reasoning: null,
    },
    {
      description: 'a sort by latency, no floor (fallbacks inside only)',
      segment: 'privacy=full&sort=latency',
      reasoning: null,
    },
  ];
  TEST_CASES_BODY.map((thisCase) =>
    test(`the request body for ${thisCase.description} matches snapshot`, async () => {
      const { openai, requests } = genOpenAiFake({ provider: 'Cheap' });
      await getOneSuppliedCompletion(
        {
          apiKey: 'fake',
          model: REQUEST.model,
          request: REQUEST,
          filters: asSupplyFilters({ segment: thisCase.segment }),
          paramsRequired: [],
          reasoning: thisCase.reasoning,
          expectsJson: false,
        },
        {
          openai,
          sdkOpenRouterEndpoints: genSdkFake({
            endpoints: [
              genEndpoint({
                tag: 'cheap',
                providerName: 'Cheap',
                pricePerMillion: 0.1,
                params: ['response_format', 'tools', 'reasoning'],
              }),
            ],
          }),
        },
      );
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchSnapshot();
    }),
  );
});

/**
 * .what = a fake openai client that routes each send to the first admitted tag
 *         and answers per that host: a served reply, or openrouter's host error
 * .why = the hop must be seen end to end through the supply, as `brain.ask`
 *        composes it: the served check reads the final admitted set, and the
 *        report and the exhausted error are what a caller receives
 *
 * .note = the errors are the real `OpenAI.APIError`; the body is openrouter's
 *         host-error shape, captured live 2026-10-21 (see asHostFault.test.ts)
 */
const genOpenAiFakeByHost = (input: {
  behaviorByTag: Record<
    string,
    | { serve: string; content?: string }
    | { status: number; raw: string; retryAfter: string }
  >;
}) => {
  const admits: string[][] = [];
  const openai = {
    chat: {
      completions: {
        create: async (request: { provider: { only: string[] } }) => {
          admits.push(request.provider.only);
          const tag = request.provider.only[0]!;
          const behavior = input.behaviorByTag[tag];
          if (!behavior)
            throw new Error(`fake: no behavior declared for tag ${tag}`); // a fixture defect, never a host fault
          if ('serve' in behavior)
            return {
              id: `gen-${tag}`,
              provider: behavior.serve,
              usage: { cost: 0.00001 },
              choices: [
                {
                  index: 0,
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: behavior.content ?? 'hi',
                  },
                },
              ],
            };
          throw new OpenAI.APIError(
            behavior.status,
            {
              message: 'Provider returned error',
              code: behavior.status,
              metadata: {
                provider_name: ENDPOINTS.find((e) => e.tag === tag)!
                  .providerName,
                raw: behavior.raw,
              },
            },
            undefined,
            new Headers({ 'retry-after': behavior.retryAfter }),
          );
        },
      },
    },
  } as unknown as OpenAI; // .note = a fake with only the one method the supply calls. removal: when the context declares that one method as its own structural type, the fake fits with no cast
  return { openai, admits };
};

describe('getOneSuppliedCompletion, a host fault on the admitted set (#21)', () => {
  given('[case1] the cheaper admitted host throttles, the other serves', () => {
    when('[t0] a filtered ask with no floor is supplied', () => {
      const scene = useThen('it serves', async () => {
        const { openai, admits } = genOpenAiFakeByHost({
          behaviorByTag: {
            cheap: {
              status: 429,
              raw: '{"error":{"message":"rate limited upstream"}}',
              retryAfter: '7',
            },
            dear: { serve: 'Dear' },
          },
        });
        const result = await getOneSuppliedCompletion(
          {
            apiKey: 'fake',
            model: REQUEST.model,
            request: REQUEST,
            filters: asSupplyFilters({ segment: 'privacy=full' }),
            paramsRequired: [],
            expectsJson: false,
            reasoning: null,
          },
          { openai, sdkOpenRouterEndpoints: genSdkFake() },
        );
        return { supply: result.supply, admits };
      });

      then('the re-send excludes the throttled host', () => {
        expect(scene.admits).toEqual([['cheap', 'dear'], ['dear']]);
      });

      then('the served check accepts the host left in the set', () => {
        expect(scene.supply.provider).toEqual('Dear');
      });

      then('the report names the hop, then the serve', () => {
        expect(scene.supply.attempts).toEqual([
          { tag: 'cheap', outcome: 'throttled' },
          { tag: 'dear', outcome: 'served' },
        ]);
      });

      then('the supply report a caller audits matches snapshot', () => {
        expect(scene.supply).toMatchSnapshot();
      });
    });
  });

  // .why = the floor walk returns only the steps it passed over; the supply
  //        appends the serve. so the full floor trail is proven here, composed
  given(
    '[case1b] on the floor, the cheapest host throttles, the next serves',
    () => {
      when('[t0] a floor ask is supplied', () => {
        const scene = useThen('it serves', async () => {
          const { openai, admits } = genOpenAiFakeByHost({
            behaviorByTag: {
              cheap: {
                status: 429,
                raw: '{"error":{"message":"rate limited upstream"}}',
                retryAfter: '7',
              },
              dear: { serve: 'Dear' },
            },
          });
          const result = await getOneSuppliedCompletion(
            {
              apiKey: 'fake',
              model: REQUEST.model,
              request: REQUEST,
              filters: asSupplyFilters({ segment: 'floor' }),
              paramsRequired: [],
              expectsJson: false,
              reasoning: null,
            },
            { openai, sdkOpenRouterEndpoints: genSdkFake() },
          );
          return { supply: result.supply, admits };
        });

        then('the walk sends to the cheapest host, then the next', () => {
          expect(scene.admits).toEqual([['cheap'], ['dear']]);
        });

        then('the report names the throttle, then the serve', () => {
          expect(scene.supply.attempts).toEqual([
            { tag: 'cheap', outcome: 'throttled' },
            { tag: 'dear', outcome: 'served' },
          ]);
        });

        then('the supply report a caller audits matches snapshot', () => {
          expect(scene.supply).toMatchSnapshot();
        });
      });
    },
  );

  // .why = each other step the floor walk takes must compose with the serve the
  //        supply appends, as the throttle does in [case1b]
  [
    {
      caseName:
        '[case1c] on the floor, the cheapest host refuses (404), the next serves',
      cheap: {
        status: 404,
        raw: '{"error":{"message":"no endpoint found"}}',
        retryAfter: '',
      },
      expectsJson: false,
      outcome: 'refused',
    },
    {
      caseName:
        '[case1d] on the floor, the cheapest host fails (host 400), the next serves',
      cheap: {
        status: 400,
        raw: '{"error":{"message":"maximum context length exceeded"}}',
        retryAfter: '',
      },
      expectsJson: false,
      outcome: 'failed',
    },
    {
      caseName:
        '[case1e] on the floor, the cheapest host answers a json ask in prose, the next serves',
      cheap: { serve: 'Cheap', content: 'hi there' },
      expectsJson: true,
      outcome: 'prose',
    },
  ].map((thisCase) =>
    given(thisCase.caseName, () => {
      when('[t0] a floor ask is supplied', () => {
        const scene = useThen('it serves', async () => {
          const { openai, admits } = genOpenAiFakeByHost({
            behaviorByTag: {
              cheap: thisCase.cheap,
              dear: { serve: 'Dear', content: '{"ok":true}' },
            },
          });
          const result = await getOneSuppliedCompletion(
            {
              apiKey: 'fake',
              model: REQUEST.model,
              request: REQUEST,
              filters: asSupplyFilters({ segment: 'floor' }),
              paramsRequired: thisCase.expectsJson ? ['response_format'] : [],
              expectsJson: thisCase.expectsJson,
              reasoning: null,
            },
            { openai, sdkOpenRouterEndpoints: genSdkFake() },
          );
          return { supply: result.supply, admits };
        });

        then('the walk sends to the cheapest host, then the next', () => {
          expect(scene.admits).toEqual([['cheap'], ['dear']]);
        });

        then(
          `the report names the ${thisCase.outcome} step, then the serve`,
          () => {
            expect(scene.supply.attempts).toEqual([
              { tag: 'cheap', outcome: thisCase.outcome },
              { tag: 'dear', outcome: 'served' },
            ]);
          },
        );
      });
    }),
  );

  // .why = a host can reject the caller's own request (a prompt over its context
  //        window) under openrouter's host marker; the caller must read that
  //        reason, not only "retry later"
  given(
    '[case2] every admitted host faults, the last on the request itself',
    () => {
      when('[t0] the error is named as `brain.ask` names it', () => {
        const scene = useThen('it fails loud', async () => {
          const { openai } = genOpenAiFakeByHost({
            behaviorByTag: {
              cheap: {
                status: 429,
                raw: '{"error":{"message":"rate limited upstream"}}',
                retryAfter: '7',
              },
              dear: {
                status: 400,
                raw: '{"error":{"message":"This endpoint\'s maximum context length is 163840 tokens. However, you requested about 201234 tokens."}}',
                retryAfter: '',
              },
            },
          });
          const error = await getError(
            getOneSuppliedCompletion(
              {
                apiKey: 'fake',
                model: REQUEST.model,
                request: REQUEST,
                filters: asSupplyFilters({ segment: 'privacy=full' }),
                paramsRequired: [],
                expectsJson: false,
                reasoning: null,
              },
              { openai, sdkOpenRouterEndpoints: genSdkFake() },
            ),
          );
          const named = await getOneAskErrorNamed(
            {
              error,
              model: REQUEST.model,
              filterSuffix: '/privacy=full',
              apiKey: 'fake',
            },
            {
              sdkOpenRouterEndpoints: {
                getAllCatalogModels: async () => {
                  throw new Error('fake: the catalog is read only for a 404');
                },
              },
            },
          );
          // .note = plain data; an Error's message does not survive the proxy
          return {
            isMalfunction: named instanceof MalfunctionError,
            message: named instanceof Error ? named.message : String(named),
          };
        });

        then('the caller receives the exhausted MalfunctionError', () => {
          expect(scene.isMalfunction).toEqual(true);
        });

        then("it shows the last host's own reason", () => {
          expect(scene.message).toContain(
            "last host fault: This endpoint's maximum context length is 163840 tokens.",
          );
        });

        then('it says to fix the request before a retry', () => {
          expect(scene.message).toContain(
            'fix the request; else retry after 7s',
          );
        });

        then('the message the caller sees matches snapshot', () => {
          expect(scene.message).toMatchSnapshot();
        });
      });
    },
  );
});
