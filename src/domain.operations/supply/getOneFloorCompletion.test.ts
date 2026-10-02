import { MalfunctionError } from 'helpful-errors';
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
  | 429
  | 404
  | 500;

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
        create: async (request: {
          provider: { only: string[]; allow_fallbacks: boolean };
        }) => {
          const tag = request.provider.only[0]!;
          admits.push({
            only: request.provider.only,
            allowFallbacks: request.provider.allow_fallbacks,
          });
          const behavior = input.behaviorByTag[tag];
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
            `${behavior} from ${tag}`,
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
  zdr: true,
});

const FILTERS: SupplyFilters = {
  floor: true,
  speedMinTps: null,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
};

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

      then('the attempt trail is one served hop', () => {
        expect(scene.attempts).toEqual([{ tag: 'cheap', outcome: 'served' }]);
      });

      then('no cache entry is dropped', () => {
        expect(scene.dels).toEqual([]);
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
          { tag: 'mid', outcome: 'served' },
        ]);
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
            { tag: 'mid', outcome: 'served' },
          ]);
        });

        then(
          "the model's cached endpoint list is dropped (case=21 [t2])",
          () => {
            expect(scene.dels).toEqual([MODEL]);
          },
        );
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
        expect(scene.attempts).toEqual([
          { tag: 'cheap', outcome: 'failed' },
          { tag: 'mid', outcome: 'served' },
        ]);
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
          expect(scene.attempts).toEqual([
            { tag: 'cheap', outcome: 'failed' },
            { tag: 'mid', outcome: 'served' },
          ]);
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
          expect(scene.attempts).toEqual([
            { tag: 'cheap', outcome: 'prose' },
            { tag: 'mid', outcome: 'served' },
          ]);
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
              },
              { openai, sdkOpenRouterEndpoints },
            ),
          );
          expect(error).toBeInstanceOf(OpenAI.APIError);
          expect(admits.map((p) => p.only)).toEqual([['cheap']]);
          expect(dels).toEqual([]);
        },
      );
    });
  });
});
