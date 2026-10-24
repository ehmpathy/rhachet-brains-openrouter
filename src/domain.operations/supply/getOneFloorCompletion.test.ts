import { MalfunctionError } from 'helpful-errors';
import type { IsoDuration } from 'iso-time';
import OpenAI from 'openai';
import { getError, given, then, useThen, when } from 'test-fns';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneFloorCompletion } from './getOneFloorCompletion';

/**
 * .what = how the fake openrouter answers a call that admits each tag
 * .why = each case declares its hosts' behavior; no network
 */
type HostBehavior =
  | 'serve'
  | 'serveJson'
  | 'prose'
  | 'fail'
  | 'errorBody'
  | 'hostError400' // a 400 the host returned, as openrouter marks it (captured 2026-10-21)
  | 'hostError400Reason' // a host 400 whose body names a reason (a context limit)
  | 'callerError400' // a 400 openrouter returned for the request itself
  | 'strangerError400' // a host 400 whose name is not the admitted host's
  | 'empty' // a `stop` reply with 0 chars (issue #24)
  | 'bodyCut' // a body that ends mid-json
  | 'stall' // a host that never sends a whole body
  | 429
  | 404
  | 500
  | 502;

/**
 * .what = the content each served behavior answers with
 * .why = a json ask tells a schema-faithful host (`serveJson`) from one that
 *        answered prose (`prose`); a plain ask reads `serve`
 */
const CONTENT_BY_BEHAVIOR: Record<string, string> = {
  serve: 'ok',
  serveJson: '{"content":"ok"}',
  prose: 'Sure! Here is the answer: ok',
  fail: '',
  empty: '',
};

/**
 * .what = a fake openai client that answers per admitted tag, and records each admitted set
 * .why = the walk's contract is the order it admits and how it reacts to each answer
 *
 * .note = the errors are the real `OpenAI.APIError`, since the walk reads `status`
 */
const genOpenAiFake = (input: {
  behaviorByTag: Record<string, HostBehavior>;
}) => {
  const admits: { only: string[]; allowFallbacks: boolean }[] = [];
  const openai = {
    chat: {
      completions: {
        // .note = two positional args, as the sdk's `create(body, options)` takes them
        create: async (
          request: {
            provider: { only: string[]; allow_fallbacks: boolean };
          },
          options: { signal: AbortSignal },
        ) => {
          const tag = request.provider.only[0]!;
          admits.push({
            only: request.provider.only,
            allowFallbacks: request.provider.allow_fallbacks,
          });
          const behavior = input.behaviorByTag[tag];
          // a body that ends mid-json: the sdk's parse raises a SyntaxError
          if (behavior === 'bodyCut')
            throw new SyntaxError('Unexpected end of JSON input');
          // a host that never sends a whole body: only the abort ends the call
          if (behavior === 'stall')
            return new Promise((_, reject) =>
              options.signal.addEventListener('abort', () =>
                reject(new OpenAI.APIUserAbortError()),
              ),
            );
          // a host 400 carries openrouter's marker and the host's name
          if (behavior === 'hostError400')
            throw new OpenAI.APIError(
              400,
              {
                message: 'Provider returned error',
                code: 400,
                metadata: { provider_name: tag, raw: '{}' },
              },
              undefined,
              new Headers(),
            );
          // a host 400 may carry its own reason, which may name the request
          if (behavior === 'hostError400Reason')
            throw new OpenAI.APIError(
              400,
              {
                message: 'Provider returned error',
                code: 400,
                metadata: {
                  provider_name: tag,
                  raw: JSON.stringify({
                    error: { message: 'maximum context length exceeded' },
                  }),
                },
              },
              undefined,
              new Headers(),
            );
          // a host 400 may name a host other than the one admitted
          if (behavior === 'strangerError400')
            throw new OpenAI.APIError(
              400,
              {
                message: 'Provider returned error',
                code: 400,
                metadata: { provider_name: 'Stranger', raw: '{}' },
              },
              undefined,
              new Headers(),
            );
          // a caller 400 carries neither
          if (behavior === 'callerError400')
            throw new OpenAI.APIError(
              400,
              { message: 'messages: field required', code: 400 },
              undefined,
              new Headers(),
            );
          // a host can also answer 200 with an `error` where `choices` belongs
          if (behavior === 'errorBody')
            return {
              id: `gen-${tag}`,
              error: { message: 'Provider returned error', code: 502 },
            };
          // a host that serves ends its reply with 'stop'; one that fails
          // mid-reply answers 200 and ends it with 'error'
          if (typeof behavior === 'string')
            return {
              id: `gen-${tag}`,
              provider: tag,
              choices: [
                {
                  index: 0,
                  finish_reason: behavior === 'fail' ? 'error' : 'stop',
                  message: {
                    role: 'assistant',
                    content: CONTENT_BY_BEHAVIOR[behavior],
                  },
                },
              ],
            };
          throw new OpenAI.APIError(
            behavior,
            undefined,
            `host error from ${tag}`, // the sdk prefixes the status itself
            new Headers(behavior === 429 ? { 'retry-after': '7' } : {}),
          );
        },
      },
    },
  } as unknown as OpenAI; // .note = a fake with only the one method the walk calls. removal: when the context declares that one method as its own structural type, the fake fits with no cast
  return { openai, admits };
};

/**
 * .what = a fake cache that records each model it was asked to drop, and each
 *         host it was asked to remember as json-ignored
 * .why = proves a refusal invalidates the stale endpoint list (case=21), and a
 *        prose reply is remembered for its model and host alone
 */
const genSdkFake = () => {
  const dels: string[] = [];
  const marks: { model: string; tag: string }[] = [];
  return {
    dels,
    marks,
    sdkOpenRouterEndpoints: {
      delForModel: async (input: { model: string }) => {
        dels.push(input.model);
      },
      setJsonIgnoredTag: async (input: { model: string; tag: string }) => {
        marks.push(input);
      },
    },
  };
};

const genEndpoint = (input: { tag: string }): OpenRouterEndpoint => ({
  providerName: input.tag,
  tag: input.tag,
  quantization: null,
  supportedParameters: [],
  pricePromptUsdPerToken: 0.00000003,
  priceCompletionUsdPerToken: 0.0000005,
  throughputTps: 80,
  maxCompletionTokens: null,
  zdr: true,
});

const FILTERS: SupplyFilters = {
  floor: true,
  speedMinTps: null,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
  sort: null,
};

const BOUND: IsoDuration = { milliseconds: 50 }; // each hop's bound; short, so a stall case settles fast
const MODEL = 'deepseek/deepseek-v4.1-flash';
const QUEUE = ['cheap', 'mid', 'dear'].map((tag) => genEndpoint({ tag }));
const REQUEST = {
  model: MODEL,
  messages: [{ role: 'user' as const, content: 'hi' }],
};

/**
 * .what = runs the walk against one set of host behaviors
 * .why = every case below shares the same queue, request, and fakes
 */
const runWalk = async (input: {
  behaviorByTag: Record<string, HostBehavior>;
  expectsJson: boolean;
}) => {
  const { openai, admits } = genOpenAiFake(input);
  const { dels, marks, sdkOpenRouterEndpoints } = genSdkFake();
  const result = await getOneFloorCompletion(
    {
      model: MODEL,
      request: REQUEST,
      filters: FILTERS,
      expectsJson: input.expectsJson,
      queue: QUEUE,
      attempts: [],
      retryAfter: null,
      faultLast: null,
      bound: BOUND,
    },
    { openai, sdkOpenRouterEndpoints },
  );
  return {
    servedTag: result.admitted.map((endpoint) => endpoint.tag).join(','),
    attempts: result.attempts,
    admitted: admits.map((p) => p.only),
    fallbacks: admits.map((p) => p.allowFallbacks),
    dels,
    marks,
  };
};

/**
 * .what = what a served walk leaves behind: each send's admitted endpoint, the
 *         trail of endpoints stepped past, and the one that served
 * .why = the caller's `supply.attempts` is this trail plus the serve; a snapshot per
 *        variant lets a reviewer read every trail shape, `prose` included
 *
 * .note = every value comes from the fixtures, so none is masked
 */
const asStableWalk = (input: {
  scene: Awaited<ReturnType<typeof runWalk>>;
}) => ({
  sends: input.scene.admitted,
  attempts: input.scene.attempts,
  servedTag: input.scene.servedTag,
});

describe('getOneFloorCompletion', () => {
  given('[case1] the cheapest endpoint serves', () => {
    when('[t0] the walk runs', () => {
      const scene = useThen('it serves', async () =>
        runWalk({
          expectsJson: false,
          behaviorByTag: { cheap: 'serve', mid: 'serve', dear: 'serve' },
        }),
      );

      then('it admits the cheapest alone, with no fallback', () => {
        expect(scene.admitted).toEqual([['cheap']]);
        expect(scene.fallbacks).toEqual([false]);
      });

      then('the trail holds no step; the serve is the caller to record', () => {
        expect(scene.attempts).toEqual([]);
      });

      then('no cache entry is dropped', () => {
        expect(scene.dels).toEqual([]);
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableWalk({ scene })).toMatchSnapshot();
      });
    });
  });

  given('[case2] the cheapest endpoint throttles (case=21)', () => {
    when('[t0] the walk runs', () => {
      const scene = useThen('it serves', async () =>
        runWalk({
          expectsJson: false,
          behaviorByTag: { cheap: 429, mid: 'serve', dear: 'serve' },
        }),
      );

      then('it steps to the next cheapest, never further', () => {
        expect(scene.admitted).toEqual([['cheap'], ['mid']]);
        expect(scene.servedTag).toEqual('mid');
      });

      then('the trail names the throttle', () => {
        expect(scene.attempts).toEqual([
          { tag: 'cheap', outcome: 'throttled' },
        ]);
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableWalk({ scene })).toMatchSnapshot();
      });

      then('a throttle drops no cache entry; the list is still true', () => {
        expect(scene.dels).toEqual([]);
      });
    });
  });

  given(
    '[case3] the cheapest endpoint is refused as absent (case=13 [t2])',
    () => {
      when('[t0] the walk runs', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: false,
            behaviorByTag: { cheap: 404, mid: 'serve', dear: 'serve' },
          }),
        );

        then('it steps to the next cheapest', () => {
          expect(scene.admitted).toEqual([['cheap'], ['mid']]);
          expect(scene.servedTag).toEqual('mid');
        });

        then('the trail names the refusal', () => {
          expect(scene.attempts).toEqual([
            { tag: 'cheap', outcome: 'refused' },
          ]);
        });

        then(
          "the model's cached endpoint list is dropped (case=21 [t2])",
          () => {
            expect(scene.dels).toEqual([MODEL]);
          },
        );

        then('the sends and the trail match snapshot', () => {
          expect(asStableWalk({ scene })).toMatchSnapshot();
        });
      });
    },
  );

  // 🔴 .why = measured 2026-10-02: the cheapest zdr host of deepseek-v4.1-flash
  //           answered 200 and failed mid-reply (finish_reason=error) on five of
  //           nine large review asks. it did not serve, so the walk must step on
  given('[case6] the cheapest endpoint fails mid-reply (F26)', () => {
    when('[t0] the walk runs', () => {
      const scene = useThen('it serves', async () =>
        runWalk({
          expectsJson: false,
          behaviorByTag: { cheap: 'fail', mid: 'serve', dear: 'serve' },
        }),
      );

      then('it steps to the next cheapest, never further', () => {
        expect(scene.admitted).toEqual([['cheap'], ['mid']]);
        expect(scene.servedTag).toEqual('mid');
      });

      then('the trail names the failed hop', () => {
        expect(scene.attempts).toEqual([{ tag: 'cheap', outcome: 'failed' }]);
      });

      then(
        'a failed reply drops no cache entry; the list is still true',
        () => {
          expect(scene.dels).toEqual([]);
        },
      );
    });
  });

  // 🔴 .why = measured 2026-10-02: two review lanes crashed with a TypeError on a
  //           200 body that held an `error` where `choices` belongs. that host
  //           did not serve, so the walk must step on, never crash
  given(
    '[case7] the cheapest endpoint answers 200 with an error body (F26)',
    () => {
      when('[t0] the walk runs', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: false,
            behaviorByTag: { cheap: 'errorBody', mid: 'serve', dear: 'serve' },
          }),
        );

        then('it steps to the next cheapest', () => {
          expect(scene.servedTag).toEqual('mid');
        });

        then('the trail names the failed hop', () => {
          expect(scene.attempts).toEqual([{ tag: 'cheap', outcome: 'failed' }]);
        });
      });
    },
  );

  // 🔴 .why = measured 2026-10-02 (F31): Phala listed the json schema params
  //           for z-ai/glm-5.3-flash and answered prose on 4 of 6 asks. a json
  //           ask must step past that host, and the machine must remember it
  given(
    '[case8] the cheapest endpoint answers prose where json is owed (F31)',
    () => {
      when('[t0] the walk runs a json ask', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: true,
            behaviorByTag: {
              cheap: 'prose',
              mid: 'serveJson',
              dear: 'serveJson',
            },
          }),
        );

        then('it steps to the next cheapest, never further', () => {
          expect(scene.admitted).toEqual([['cheap'], ['mid']]);
          expect(scene.servedTag).toEqual('mid');
        });

        then('the trail names the prose hop', () => {
          expect(scene.attempts).toEqual([{ tag: 'cheap', outcome: 'prose' }]);
        });

        then('the prose host is remembered, for this model alone', () => {
          expect(scene.marks).toEqual([{ model: MODEL, tag: 'cheap' }]);
        });

        then(
          'no cache entry is dropped; the endpoint list is still true',
          () => {
            expect(scene.dels).toEqual([]);
          },
        );

        then('the sends and the trail match snapshot', () => {
          expect(asStableWalk({ scene })).toMatchSnapshot();
        });
      });

      when('[t1] the walk runs a plain ask', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: false,
            behaviorByTag: { cheap: 'prose', mid: 'serve', dear: 'serve' },
          }),
        );

        then('prose is a fine answer: the cheapest serves', () => {
          expect(scene.servedTag).toEqual('cheap');
        });

        then('no host is remembered', () => {
          expect(scene.marks).toEqual([]);
        });
      });
    },
  );

  // 🔴 .why = measured 2026-10-21: every 1.vision peer reviewer of three crews
  //           died on `400 Provider returned error` from host OpenInference on
  //           deepseek/flash. the host failed, not the caller: step on
  given('[case9] the cheapest endpoint returns a host 400', () => {
    when('[t0] the walk runs', () => {
      const scene = useThen('it serves', async () =>
        runWalk({
          expectsJson: false,
          behaviorByTag: { cheap: 'hostError400', mid: 'serve', dear: 'serve' },
        }),
      );

      then('it steps to the next cheapest, never further', () => {
        expect(scene.admitted).toEqual([['cheap'], ['mid']]);
        expect(scene.servedTag).toEqual('mid');
      });

      then('the trail names the failed hop', () => {
        expect(scene.attempts).toEqual([{ tag: 'cheap', outcome: 'failed' }]);
      });

      then('a host 400 drops no cache entry; the list is still true', () => {
        expect(scene.dels).toEqual([]);
      });

      then('the sends and the trail match snapshot', () => {
        expect(asStableWalk({ scene })).toMatchSnapshot();
      });
    });
  });

  given("[case10] the cheapest endpoint returns the caller's own 400", () => {
    when('[t0] the walk runs', () => {
      then(
        'the error rethrows untouched, and no other endpoint is tried',
        async () => {
          const { openai, admits } = genOpenAiFake({
            behaviorByTag: {
              cheap: 'callerError400',
              mid: 'serve',
              dear: 'serve',
            },
          });
          const { sdkOpenRouterEndpoints } = genSdkFake();
          const error = await getError(
            getOneFloorCompletion(
              {
                model: MODEL,
                request: REQUEST,
                filters: FILTERS,
                expectsJson: false,
                queue: QUEUE,
                attempts: [],
                retryAfter: null,
                faultLast: null,
                bound: BOUND,
              },
              { openai, sdkOpenRouterEndpoints },
            ),
          );
          expect(error).toBeInstanceOf(OpenAI.APIError);
          expect(error.message).toContain('messages: field required');
          expect(admits.map((p) => p.only)).toEqual([['cheap']]);
          expect(error.message).toMatchSnapshot(); // the message the caller sees
        },
      );
    });
  });

  given(
    '[case11] the cheapest endpoint returns a host 400 that names a stranger',
    () => {
      when('[t0] the walk runs', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: false,
            behaviorByTag: {
              cheap: 'strangerError400',
              mid: 'serve',
              dear: 'serve',
            },
          }),
        );

        then(
          'it steps anyway: the walk admitted one host, so the fault is its',
          () => {
            expect(scene.admitted).toEqual([['cheap'], ['mid']]);
            expect(scene.attempts).toEqual([
              { tag: 'cheap', outcome: 'failed' },
            ]);
          },
        );
      });
    },
  );

  given('[case4] every qualified endpoint throttles, refuses, or fails', () => {
    when('[t0] the walk runs', () => {
      const scene = useThen('it fails loud', async () => {
        const error = await getError(
          runWalk({
            expectsJson: false,
            behaviorByTag: { cheap: 429, mid: 404, dear: 'fail' },
          }),
        );
        // .note = plain data; an Error's message does not survive the proxy
        return {
          isMalfunction: error instanceof MalfunctionError,
          message: error.message,
        };
      });

      then('it is a MalfunctionError', () => {
        expect(scene.isMalfunction).toEqual(true);
      });

      then('it lists every attempt, in price order', () => {
        expect(scene.message).toContain('throttled cheap');
        expect(scene.message).toContain('refused   mid');
        expect(scene.message).toContain('failed    dear');
      });

      then("it names openrouter's retry-after wait (case=14)", () => {
        expect(scene.message).toContain('retry after 7s');
      });

      then('the message matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // .why = the refusal speaks only of the last host. a host that fails
  //        mid-reply threw no error, so `cheap`'s reason is dropped on purpose:
  //        to show it would offer "fix the request" for a fault the walk got past.
  //        the snapshot shows that drop, the three `failed` rows, and `retry later`
  given(
    '[case12] a host 400 names a reason, then the later hosts fail mid-reply',
    () => {
      when('[t0] the walk runs', () => {
        const scene = useThen('it fails loud', async () => {
          const error = await getError(
            runWalk({
              expectsJson: false,
              behaviorByTag: {
                cheap: 'hostError400Reason',
                mid: 'fail',
                dear: 'fail',
              },
            }),
          );
          const cause = 'cause' in error ? error.cause : undefined;
          return {
            isMalfunction: error instanceof MalfunctionError,
            message: error.message,
            hasCause: cause !== undefined && cause !== null,
          };
        });

        then('it lists every host it stepped past', () => {
          expect(scene.isMalfunction).toEqual(true);
          expect(scene.message).toContain('failed    cheap');
          expect(scene.message).toContain('failed    dear');
        });

        then(
          "the last host failed mid-reply, so no earlier host's reason is shown as the last",
          () => {
            expect(scene.message).not.toContain('last host fault');
            expect(scene.hasCause).toEqual(false);
          },
        );

        then('the request is not blamed for a mid-reply failure', () => {
          expect(scene.message).not.toContain('fix the request');
        });

        then('the message matches snapshot', () => {
          expect(scene.message).toMatchSnapshot();
        });
      });
    },
  );

  // 🔴 .why = measured 2026-10-21: four of six vision reviews on deepseek flash died
  //           on one host: a body cut mid-json once, a stall past 21 minutes three
  //           times. openrouter served the whole time; the next host was one hop away
  given(
    '[case13] the cheapest endpoint cuts its body or stalls (case=9)',
    () => {
      when('[t1] the cheapest ends its body mid-json', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: false,
            behaviorByTag: { cheap: 'bodyCut', mid: 'serve', dear: 'serve' },
          }),
        );

        then('it steps to the next cheapest, never a raw SyntaxError', () => {
          expect(scene.servedTag).toEqual('mid');
        });

        then('the trail names the cut body', () => {
          expect(scene.attempts).toEqual([
            { tag: 'cheap', outcome: 'body-cut' },
          ]);
        });
      });

      when('[t2] the cheapest sends no whole body inside the bound', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: false,
            behaviorByTag: { cheap: 'stall', mid: 'serve', dear: 'serve' },
          }),
        );

        then('it aborts that hop at the bound, and steps to the next', () => {
          expect(scene.admitted).toEqual([['cheap'], ['mid']]);
          expect(scene.servedTag).toEqual('mid');
        });

        then('the trail names the stall', () => {
          expect(scene.attempts).toEqual([
            { tag: 'cheap', outcome: 'stalled' },
          ]);
        });
      });

      when('[t3] every qualified host stalls', () => {
        const scene = useThen('it fails loud', async () => {
          const error = await getError(
            runWalk({
              expectsJson: false,
              behaviorByTag: { cheap: 'stall', mid: 'stall', dear: 'stall' },
            }),
          );
          return {
            isMalfunction: error instanceof MalfunctionError,
            message: error.message,
          };
        });

        then('it is the floor-exhausted MalfunctionError', () => {
          expect(scene.isMalfunction).toEqual(true);
        });

        then(
          'it stops after two stalls, and names the host left untried',
          () => {
            expect(scene.message).toContain('stalled   cheap');
            expect(scene.message).toContain('stalled   mid');
            expect(scene.message).not.toContain('stalled   dear');
            expect(scene.message).toContain(
              'the walk stopped after 2 stalled hosts, with 1 untried',
            );
          },
        );

        then(
          'the fix names a thought cap as the lever for a slow answer (case=9)',
          () => {
            expect(scene.message).toContain('cap thought (effort on the ask)');
          },
        );

        then('the message a caller reads matches snapshot', () => {
          expect(scene.message).toMatchSnapshot();
        });
      });
    },
  );

  given('[case14] the cheapest endpoint answers a 502 (issue #12)', () => {
    when('[t0] the walk runs', () => {
      const scene = useThen('it serves', async () =>
        runWalk({
          expectsJson: false,
          behaviorByTag: { cheap: 502, mid: 'serve', dear: 'serve' },
        }),
      );

      then('it steps to the next cheapest', () => {
        expect(scene.admitted).toEqual([['cheap'], ['mid']]);
        expect(scene.servedTag).toEqual('mid');
      });

      then('the trail names the failed hop', () => {
        expect(scene.attempts).toEqual([{ tag: 'cheap', outcome: 'failed' }]);
      });

      then('a 502 drops no cache entry; the list is still true', () => {
        expect(scene.dels).toEqual([]);
      });
    });
  });

  // 🔴 .why = measured 2026-10 (issue #24): Morph answered `stop` with 0 chars on three
  //           of three json asks; the walk read it as served, the ask then threw
  given(
    '[case15] the cheapest endpoint ends a json ask with no content (issue #24)',
    () => {
      when('[t0] the walk runs a json ask', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: true,
            behaviorByTag: {
              cheap: 'empty',
              mid: 'serveJson',
              dear: 'serveJson',
            },
          }),
        );

        then('it steps to the next cheapest', () => {
          expect(scene.servedTag).toEqual('mid');
        });

        then('the trail names the empty hop', () => {
          expect(scene.attempts).toEqual([{ tag: 'cheap', outcome: 'empty' }]);
        });

        then('the empty host is remembered, as a prose host is', () => {
          expect(scene.marks).toEqual([{ model: MODEL, tag: 'cheap' }]);
        });
      });

      when('[t1] the walk runs a plain ask', () => {
        const scene = useThen('it serves', async () =>
          runWalk({
            expectsJson: false,
            behaviorByTag: { cheap: 'empty', mid: 'serve', dear: 'serve' },
          }),
        );

        then(
          'an empty plain reply is not a json defect: the cheapest serves',
          () => {
            expect(scene.servedTag).toEqual('cheap');
            expect(scene.marks).toEqual([]);
          },
        );
      });
    },
  );

  given('[case5] the cheapest endpoint fails for another reason', () => {
    when('[t0] the walk runs', () => {
      then(
        'the error rethrows untouched, and no other endpoint is tried',
        async () => {
          const { openai, admits } = genOpenAiFake({
            behaviorByTag: { cheap: 500, mid: 'serve', dear: 'serve' },
          });
          const { dels, sdkOpenRouterEndpoints } = genSdkFake();
          const error = await getError(
            getOneFloorCompletion(
              {
                model: MODEL,
                request: REQUEST,
                filters: FILTERS,
                expectsJson: false,
                queue: QUEUE,
                attempts: [],
                retryAfter: null,
                faultLast: null,
                bound: BOUND,
              },
              { openai, sdkOpenRouterEndpoints },
            ),
          );
          expect(error).toBeInstanceOf(OpenAI.APIError);
          expect(admits.map((p) => p.only)).toEqual([['cheap']]);
          expect(dels).toEqual([]);
          expect(error.message).toMatchSnapshot(); // the message the caller sees
        },
      );
    });
  });
});
