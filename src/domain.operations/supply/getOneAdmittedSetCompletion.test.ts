import { MalfunctionError } from 'helpful-errors';
import OpenAI from 'openai';
import { getError, given, then, useThen, when } from 'test-fns';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneAdmittedSetCompletion } from './getOneAdmittedSetCompletion';

/**
 * .what = how the fake openrouter answers when it routes to each host
 * .why = each case declares its hosts' behavior; no network
 *
 * .note = 'unnamed429' is openrouter's own normalized throttle: no name, no mark;
 *         'markedUnnamed429' is a host's throttle, marked, that names no host;
 *         'strangerError400' is a host 400 that names a host outside the set;
 *         'hostError400Bare' is a host 400 with no `retry-after` header
 */
type HostBehavior =
  | 'serve'
  | 'hostError400'
  | 'hostError400Bare'
  | 'callerError400'
  | 'strangerError400'
  | 'unnamed429'
  | 'markedUnnamed429'
  | 'unnamed404'
  | 429
  | 404;

/**
 * .what = the provider a fake tag belongs to: `A/fp8` and `A/bf16` are both `A`'s
 * .why = one provider may serve several endpoints of a model; a fault names the
 *        provider, never the tag
 */
const asProviderNameOfTag = (input: { tag: string }): string =>
  input.tag.split('/')[0]!;

/**
 * .what = an openrouter error body that names a host
 * .why = mirrors the shape captured live 2026-10-21 (see asHostFault.test.ts)
 *
 * .note = a throttle carries the host's own reason; other faults carry `{}`,
 *         which holds no reason
 */
const genHostBody = (input: { status: number; providerName: string }) => ({
  message: 'Provider returned error',
  code: input.status,
  metadata: {
    provider_name: input.providerName,
    raw:
      input.status === 429
        ? JSON.stringify({ error: { message: 'rate limited upstream' } })
        : '{}',
  },
});

/**
 * .what = a fake openai client that routes each send to the first admitted tag,
 *         answers per that host's behavior, and records each admitted set
 * .why = the hop's contract is which hosts each re-send admits, and how it reacts
 *
 * .note = the errors are the real `OpenAI.APIError`, since the hop reads `status`
 *         and the body's `metadata.provider_name`
 */
const genOpenAiFake = (input: {
  behaviorByTag: Record<string, HostBehavior>;
}) => {
  const admits: { only: string[]; allowFallbacks: boolean }[] = [];
  const openai = {
    chat: {
      completions: {
        create: async (request: {
          provider: { only: string[]; allow_fallbacks: boolean };
        }) => {
          admits.push({
            only: request.provider.only,
            allowFallbacks: request.provider.allow_fallbacks,
          });
          const tag = request.provider.only[0]!;
          const behavior = input.behaviorByTag[tag];
          if (behavior === undefined)
            throw new Error(`fake: no behavior declared for tag ${tag}`); // a fixture defect, never a host fault
          const headers = new Headers({ 'retry-after': '7' });
          if (behavior === 'hostError400Bare')
            throw new OpenAI.APIError(
              400,
              genHostBody({
                status: 400,
                providerName: asProviderNameOfTag({ tag }),
              }),
              undefined,
              new Headers(),
            );
          if (behavior === 'serve')
            return {
              id: `gen-${tag}`,
              provider: tag,
              choices: [
                {
                  index: 0,
                  finish_reason: 'stop',
                  message: { role: 'assistant', content: 'ok' },
                },
              ],
            };
          if (behavior === 'hostError400')
            throw new OpenAI.APIError(
              400,
              genHostBody({
                status: 400,
                providerName: asProviderNameOfTag({ tag }),
              }),
              undefined,
              headers,
            );
          if (behavior === 'strangerError400')
            throw new OpenAI.APIError(
              400,
              genHostBody({ status: 400, providerName: 'Stranger' }),
              undefined,
              headers,
            );
          if (behavior === 'callerError400')
            throw new OpenAI.APIError(
              400,
              { message: 'messages: field required', code: 400 },
              undefined,
              headers,
            );
          if (behavior === 'unnamed429')
            throw new OpenAI.APIError(
              429,
              { message: 'Rate limit exceeded', code: 429 },
              undefined,
              headers,
            );
          if (behavior === 'markedUnnamed429')
            throw new OpenAI.APIError(
              429,
              {
                message: 'Provider returned error',
                code: 429,
                metadata: {
                  raw: JSON.stringify({
                    error: { message: 'rate limited upstream' },
                  }),
                },
              },
              undefined,
              headers,
            );
          if (behavior === 'unnamed404')
            throw new OpenAI.APIError(
              404,
              { message: 'No endpoints found', code: 404 },
              undefined,
              headers,
            );
          throw new OpenAI.APIError(
            behavior,
            genHostBody({
              status: behavior!,
              providerName: asProviderNameOfTag({ tag }),
            }),
            undefined,
            headers,
          );
        },
      },
    },
  } as unknown as OpenAI; // .note = a fake with only the one method the hop calls. removal: when the context declares that one method as its own structural type, the fake fits with no cast
  return { openai, admits };
};

/**
 * .what = a fake cache that records each model it was asked to drop
 * .why = proves a refusal invalidates the stale endpoint list, as the floor walk does
 *
 * .note = `setJsonIgnoredTag` serves the floor walk an unnamed fault falls back to;
 *         these asks expect no json, so it is never called
 */
const genSdkFake = () => {
  const dels: string[] = [];
  return {
    dels,
    sdkOpenRouterEndpoints: {
      delForModel: async (input: { model: string }) => {
        dels.push(input.model);
      },
      setJsonIgnoredTag: async () => {
        throw new Error('fake: no json ask in this suite'); // a fixture defect, never a host fault
      },
    },
  };
};

const genEndpoint = (input: { tag: string }): OpenRouterEndpoint => ({
  providerName: asProviderNameOfTag({ tag: input.tag }),
  tag: input.tag,
  quantization: null,
  supportedParameters: [],
  pricePromptUsdPerToken: 0.00000003,
  priceCompletionUsdPerToken: 0.0000005,
  throughputTps: 120,
  zdr: true,
});

const FILTERS: SupplyFilters = {
  floor: false,
  speedMinTps: 100,
  region: null,
  precision: null,
  privacy: 'full',
  priceMaxUsdPerMillion: null,
};

const MODEL = 'deepseek/deepseek-v4.1-flash';
const REQUEST = {
  model: MODEL,
  messages: [{ role: 'user' as const, content: 'hi' }],
};

/**
 * .what = runs the admitted-set send against one set of host behaviors
 * .why = every case below shares the same request and fakes
 */
const runHop = async (input: {
  tags: string[];
  behaviorByTag: Record<string, HostBehavior>;
}) => {
  const { openai, admits } = genOpenAiFake(input);
  const { dels, sdkOpenRouterEndpoints } = genSdkFake();
  const result = await getOneAdmittedSetCompletion(
    {
      model: MODEL,
      request: REQUEST,
      filters: FILTERS,
      expectsJson: false,
      qualified: input.tags.map((tag) => genEndpoint({ tag })),
      attempts: [],
      retryAfter: null,
      faultLast: null,
    },
    { openai, sdkOpenRouterEndpoints },
  );
  return {
    servedId: result.response.id, // .note = the fake names each reply `gen-${tag}`
    admittedFinal: result.admitted.map((endpoint) => endpoint.tag),
    attempts: result.attempts,
    admitted: admits.map((p) => p.only),
    fallbacks: admits.map((p) => p.allowFallbacks),
    dels,
  };
};

/**
 * .what = what a served ask leaves behind: each send's admitted set, the trail of
 *         hosts passed over, the host that served, and the set it served from
 * .why = the caller's `supply.attempts` is this trail plus the serve; a snapshot per
 *        variant lets a reviewer read every trail shape side by side
 *
 * .note = every value comes from the fixtures, so none is masked
 */
const asStableServe = (input: {
  scene: Awaited<ReturnType<typeof runHop>>;
}) => ({
  sends: input.scene.admitted,
  attempts: input.scene.attempts,
  servedId: input.scene.servedId,
  admittedFinal: input.scene.admittedFinal,
});

/**
 * .what = runs the admitted-set send and captures the error it throws
 * .why = the rethrow and exhaustion cases read the error and the sends made
 */
const runHopToError = async (input: {
  tags: string[];
  behaviorByTag: Record<string, HostBehavior>;
}) => {
  const { openai, admits } = genOpenAiFake(input);
  const { dels, sdkOpenRouterEndpoints } = genSdkFake();
  const error = await getError(
    getOneAdmittedSetCompletion(
      {
        model: MODEL,
        request: REQUEST,
        filters: FILTERS,
        expectsJson: false,
        qualified: input.tags.map((tag) => genEndpoint({ tag })),
        attempts: [],
        retryAfter: null,
        faultLast: null,
      },
      { openai, sdkOpenRouterEndpoints },
    ),
  );
  // .note = plain data; an Error's message does not survive the proxy
  return {
    isApiError: error instanceof OpenAI.APIError,
    isMalfunction: error instanceof MalfunctionError,
    message: error.message,
    admitted: admits.map((p) => p.only),
    dels,
  };
};

describe('getOneAdmittedSetCompletion', () => {
  given('[case1] the first host openrouter picks serves', () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it serves', async () =>
        runHop({ tags: ['A', 'B', 'C'], behaviorByTag: { A: 'serve' } }),
      );

      then('it admits the whole set once, with no fallback', () => {
        expect(scene.admitted).toEqual([['A', 'B', 'C']]);
        expect(scene.fallbacks).toEqual([false]);
      });

      then('no hop is reported', () => {
        expect(scene.attempts).toEqual([]);
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableServe({ scene })).toMatchSnapshot();
      });
    });
  });

  // 🔴 .why = measured 2026-10-17 (#21): a cache suite on
  //           deepseek/flash/speed=min100tps&privacy=full failed every ask of a
  //           shard on `429 Provider returned error`. one throttled host must not
  //           fail the ask
  given('[case2] the host openrouter picks throttles (#21)', () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it serves', async () =>
        runHop({
          tags: ['A', 'B', 'C'],
          behaviorByTag: { A: 429, B: 'serve', C: 'serve' },
        }),
      );

      then('the second send excludes the throttled host', () => {
        expect(scene.admitted).toEqual([
          ['A', 'B', 'C'],
          ['B', 'C'],
        ]);
      });

      then('the reply is served', () => {
        expect(scene.servedId).toEqual('gen-B');
        expect(scene.admittedFinal).toEqual(['B', 'C']);
      });

      then('the trail names the throttle', () => {
        expect(scene.attempts).toEqual([{ tag: 'A', outcome: 'throttled' }]);
      });

      then('a throttle drops no cache entry', () => {
        expect(scene.dels).toEqual([]);
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableServe({ scene })).toMatchSnapshot();
      });
    });
  });

  // 🔴 .why = measured 2026-10-21: `400 Provider returned error` from host
  //           OpenInference killed every 1.vision peer reviewer of three crews
  given('[case3] the host openrouter picks returns a host 400', () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it serves', async () =>
        runHop({
          tags: ['A', 'B', 'C'],
          behaviorByTag: { A: 'hostError400', B: 'serve', C: 'serve' },
        }),
      );

      then('the second send excludes the failed host', () => {
        expect(scene.admitted).toEqual([
          ['A', 'B', 'C'],
          ['B', 'C'],
        ]);
      });

      then('the trail names the failed hop', () => {
        expect(scene.attempts).toEqual([{ tag: 'A', outcome: 'failed' }]);
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableServe({ scene })).toMatchSnapshot();
      });
    });
  });

  given(
    '[case4] three different faults, then a serve (the densest walk)',
    () => {
      when('[t0] the set is sent', () => {
        const scene = useThen('it serves', async () =>
          runHop({
            tags: ['A', 'B', 'C', 'D'],
            behaviorByTag: { A: 429, B: 404, C: 'hostError400', D: 'serve' },
          }),
        );

        then('each send drops the host that faulted, in turn', () => {
          expect(scene.admitted).toEqual([
            ['A', 'B', 'C', 'D'],
            ['B', 'C', 'D'],
            ['C', 'D'],
            ['D'],
          ]);
        });

        then(
          "the model's cached endpoint list is dropped once, for the 404",
          () => {
            expect(scene.dels).toEqual([MODEL]);
          },
        );

        then(
          'the reply is served, and the admitted set returned is the final one',
          () => {
            expect(scene.servedId).toEqual('gen-D');
            expect(scene.admittedFinal).toEqual(['D']);
          },
        );

        then('the trail names each fault in order', () => {
          expect(scene.attempts).toEqual([
            { tag: 'A', outcome: 'throttled' },
            { tag: 'B', outcome: 'refused' },
            { tag: 'C', outcome: 'failed' },
          ]);
        });

        then('the sends and the trail match snapshot', () => {
          expect(asStableServe({ scene })).toMatchSnapshot();
        });
      });
    },
  );

  given('[case5] every host faults', () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it fails loud', async () =>
        runHopToError({
          tags: ['A', 'B', 'C'],
          behaviorByTag: { A: 429, B: 'hostError400', C: 404 },
        }),
      );

      then('it is a MalfunctionError', () => {
        expect(scene.isMalfunction).toEqual(true);
      });

      then('it lists every hop, in order', () => {
        expect(scene.message).toContain('throttled A');
        expect(scene.message).toContain('failed    B');
        expect(scene.message).toContain('refused   C');
      });

      then("it names openrouter's retry-after wait", () => {
        expect(scene.message).toContain('retry after 7s');
      });

      then('the message matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  given("[case6] the host returns the caller's own 400", () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it fails loud', async () =>
        runHopToError({
          tags: ['A', 'B', 'C'],
          behaviorByTag: { A: 'callerError400', B: 'serve', C: 'serve' },
        }),
      );

      then('the error rethrows untouched', () => {
        expect(scene.isApiError).toEqual(true);
        expect(scene.message).toContain('messages: field required');
      });

      then('no second send is made', () => {
        expect(scene.admitted).toEqual([['A', 'B', 'C']]);
      });

      then('the message the caller sees matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // 🔴 .why = c9: openrouter's normalized `429 Rate limit exceeded` carries no
  //           name and no mark — its own account limit. no other host can fix
  //           it, and a walk would prolong the limit, so it fails in one send
  given('[case7] a fault with no host mark (openrouter answers)', () => {
    when('[t0] the send answers its normalized 429', () => {
      const scene = useThen('it fails loud', async () =>
        runHopToError({
          tags: ['A', 'B'],
          behaviorByTag: { A: 'unnamed429', B: 'serve' },
        }),
      );

      then(
        'the error rethrows untouched: openrouter limits the account',
        () => {
          expect(scene.isApiError).toEqual(true);
          expect(scene.message).toContain('Rate limit exceeded');
        },
      );

      then('exactly one send was made: no host is walked', () => {
        expect(scene.admitted).toEqual([['A', 'B']]);
      });

      then('no cache entry is dropped', () => {
        expect(scene.dels).toEqual([]);
      });

      then('the message the caller sees matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });

    when('[t1] the send answers a 404 with no name', () => {
      const scene = useThen('it fails loud', async () =>
        runHopToError({
          tags: ['A', 'B'],
          behaviorByTag: { A: 'unnamed404', B: 'serve' },
        }),
      );

      then('the error rethrows untouched, after one send', () => {
        expect(scene.isApiError).toEqual(true);
        expect(scene.admitted).toEqual([['A', 'B']]);
      });

      // .why = a 404 proves the cached list stale, named or not; a stale list
      //        whose tags are all gone must heal now, not at its 30-min ttl
      then('the cached endpoint list is dropped before the rethrow', () => {
        expect(scene.dels).toEqual([MODEL]);
      });

      then('the message the caller sees matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // 🔴 .why = #21's own message is `429 Provider returned error`: a host's
  //           throttle, marked. if it names no host, none can be dropped from
  //           the set, so the ask walks it one host per send (F8), and each
  //           send then names its host by `only`
  given('[case12] a host fault, marked, that names no host', () => {
    when('[t0] the send answers a marked 429 with no name', () => {
      const scene = useThen('it serves', async () =>
        runHop({
          tags: ['A', 'B'],
          behaviorByTag: { A: 'markedUnnamed429', B: 'serve' },
        }),
      );

      then('the rest of the ask walks the set, one host per send', () => {
        expect(scene.admitted).toEqual([['A', 'B'], ['A'], ['B']]);
        expect(scene.fallbacks).toEqual([false, false, false]);
      });

      then('the reply is served, by the one host admitted last', () => {
        expect(scene.servedId).toEqual('gen-B');
        expect(scene.admittedFinal).toEqual(['B']);
      });

      then('the trail names the throttle the walk stepped past', () => {
        expect(scene.attempts).toEqual([{ tag: 'A', outcome: 'throttled' }]);
      });

      then('no cache entry is dropped', () => {
        expect(scene.dels).toEqual([]);
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableServe({ scene })).toMatchSnapshot();
      });
    });

    when('[t1] every send answers a marked 429 with no name', () => {
      const scene = useThen('it fails loud', async () =>
        runHopToError({
          tags: ['A', 'B'],
          behaviorByTag: { A: 'markedUnnamed429', B: 'markedUnnamed429' },
        }),
      );

      then('it is a MalfunctionError, after one walk of the set', () => {
        expect(scene.isMalfunction).toEqual(true);
        expect(scene.admitted).toEqual([['A', 'B'], ['A'], ['B']]);
      });

      then("it names openrouter's retry-after wait", () => {
        expect(scene.message).toContain('retry after 7s');
      });

      then('the message the caller sees matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  given('[case8] one provider serves two endpoints, and throttles', () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it serves', async () =>
        runHop({
          tags: ['A/fp8', 'A/bf16', 'B'],
          behaviorByTag: { 'A/fp8': 429, B: 'serve' },
        }),
      );

      then("the second send excludes both of that provider's endpoints", () => {
        expect(scene.admitted).toEqual([['A/fp8', 'A/bf16', 'B'], ['B']]);
      });

      then('the trail names each endpoint dropped', () => {
        expect(scene.attempts).toEqual([
          { tag: 'A/fp8', outcome: 'throttled' },
          { tag: 'A/bf16', outcome: 'throttled' },
        ]);
      });

      then('the reply is served by the other provider', () => {
        expect(scene.servedId).toEqual('gen-B');
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableServe({ scene })).toMatchSnapshot();
      });
    });
  });

  given('[case9] a host fault that names a host outside the set', () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it serves', async () =>
        runHop({
          tags: ['A', 'B'],
          behaviorByTag: { A: 'strangerError400', B: 'serve' },
        }),
      );

      then('no host can be dropped, so the ask walks the set', () => {
        expect(scene.admitted).toEqual([['A', 'B'], ['A'], ['B']]);
      });

      then('the walk steps past the host that failed alone, and serves', () => {
        expect(scene.attempts).toEqual([{ tag: 'A', outcome: 'failed' }]);
        expect(scene.servedId).toEqual('gen-B');
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableServe({ scene })).toMatchSnapshot();
      });
    });
  });

  given('[case11] every host throttles, each with its own reason', () => {
    when('[t0] the set is sent', () => {
      const scene = useThen('it fails loud', async () =>
        runHopToError({
          tags: ['A', 'B'],
          behaviorByTag: { A: 429, B: 429 },
        }),
      );

      then("it shows the last host's reason", () => {
        expect(scene.message).toContain(
          'last host fault: rate limited upstream',
        );
      });

      then('a throttle never blames the request', () => {
        expect(scene.message).not.toContain('fix the request');
        expect(scene.message).toContain("fix: retry after 7s (openrouter's");
      });

      then('the message the caller sees matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  given(
    '[case10] a throttle names a wait, then a later host fault names none',
    () => {
      when('[t0] the set is sent and every host faults', () => {
        const scene = useThen('it fails loud', async () =>
          runHopToError({
            tags: ['A', 'B'],
            behaviorByTag: { A: 429, B: 'hostError400Bare' },
          }),
        );

        then('the wait from the earlier throttle is kept', () => {
          expect(scene.isMalfunction).toEqual(true);
          expect(scene.message).toContain('retry after 7s');
        });

        then('the message the caller sees matches snapshot', () => {
          expect(scene.message).toMatchSnapshot();
        });
      });
    },
  );
});
