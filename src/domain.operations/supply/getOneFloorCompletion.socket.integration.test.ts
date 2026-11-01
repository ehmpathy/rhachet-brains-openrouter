import { MalfunctionError } from 'helpful-errors';
import OpenAI from 'openai';
import { getError, given, then, useBeforeAll, useThen, when } from 'test-fns';

import { createServer, type IncomingMessage, type Server } from 'node:http';
import { HostFaultError } from '../../domain.objects/HostFaultError';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import type { SupplyFilters } from './asSupplyFilters';
import { getOneAdmittedSetCompletion } from './getOneAdmittedSetCompletion';
import { getOneFloorCompletion } from './getOneFloorCompletion';
import { getOneSuppliedCompletion } from './getOneSuppliedCompletion';

/**
 * .what = how each fake host answers, keyed by its tag
 * .why = each tag is one real socket behavior: a body cut mid-json, a body that never
 *        comes, a 5xx, a whole reply, a reply spent on thought, and a 0-char `stop` reply
 */
type HostBehavior = 'cut' | 'stall' | 'down' | 'serve' | 'allthought' | 'empty';

const MODEL = 'deepseek/deepseek-v4.1-flash';

/**
 * .what = a whole chat completion, as openrouter shapes it
 * .why = the walk and the defect check read this shape off a real socket
 */
const genCompletionBody = (input: {
  provider: string;
  content: string;
  finishReason: 'stop' | 'length';
  tokensOutput: number;
  tokensThought: number;
}) => ({
  id: 'gen-socket-test',
  object: 'chat.completion',
  created: 1_760_000_000,
  model: MODEL,
  provider: input.provider,
  choices: [
    {
      index: 0,
      finish_reason: input.finishReason,
      message: { role: 'assistant', content: input.content },
    },
  ],
  usage: {
    prompt_tokens: 20,
    completion_tokens: input.tokensOutput,
    total_tokens: 20 + input.tokensOutput,
    completion_tokens_details: { reasoning_tokens: input.tokensThought },
  },
});

/**
 * .what = the request body a fake host received, read off the socket
 */
const asRequestBody = async (
  req: IncomingMessage,
): Promise<{ provider?: { only?: string[] } }> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

/**
 * .what = a local http server that plays openrouter, one behavior per admitted host
 * .why = only a real socket proves that undici's own errors map to the named faults;
 *        a hand-built error proves only the map
 */
const genFakeOpenRouter = (): Promise<{ server: Server; baseURL: string }> =>
  new Promise((resolveStart) => {
    const server = createServer(async (req, res) => {
      const body = await asRequestBody(req);
      const behavior = body.provider?.only?.[0]; // the admitted tag names the behavior

      // a body that ends mid-json: headers promise more, then the socket dies
      if (behavior === 'cut') {
        res.writeHead(200, {
          'content-type': 'application/json',
          'content-length': '4096',
        });
        res.write('{"id":"gen-socket-test","choices":[{"mess');
        setTimeout(() => res.socket?.destroy(), 20);
        return;
      }

      // a body that never comes: headers sent, then silence
      if (behavior === 'stall') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return;
      }

      // a host that fails upstream
      if (behavior === 'down') {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({ error: { message: 'upstream down', code: 502 } }),
        );
        return;
      }

      // a reply spent whole on thought, or a whole answer
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          behavior === 'empty'
            ? genCompletionBody({
                provider: 'empty',
                content: '',
                finishReason: 'stop',
                tokensOutput: 2400,
                tokensThought: 2400,
              })
            : behavior === 'allthought'
              ? genCompletionBody({
                  provider: 'allthought',
                  content: '',
                  finishReason: 'length',
                  tokensOutput: 200,
                  tokensThought: 200,
                })
              : genCompletionBody({
                  provider: 'serve',
                  content: '{"verdict":"yes"}',
                  finishReason: 'stop',
                  tokensOutput: 12,
                  tokensThought: 4,
                }),
        ),
      );
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolveStart({ server, baseURL: `http://127.0.0.1:${port}/api/v1` });
    });
  });

const genEndpoint = (input: {
  tag: HostBehavior;
  promptPerMillion: number;
}): OpenRouterEndpoint => ({
  providerName: input.tag,
  tag: input.tag,
  quantization: 'fp8',
  supportedParameters: ['response_format', 'structured_outputs'],
  pricePromptUsdPerToken: input.promptPerMillion / 1e6,
  priceCompletionUsdPerToken: 0.2 / 1e6,
  throughputTps: 90,
  maxCompletionTokens: null,
  zdr: true,
});

const FILTERS_FLOOR: SupplyFilters = {
  floor: true,
  speedMinTps: null,
  region: null,
  precision: null,
  privacy: null,
  priceMaxUsdPerMillion: null,
  sort: null,
};

const REQUEST: OpenAI.ChatCompletionCreateParamsNonStreaming = {
  model: MODEL,
  messages: [{ role: 'user', content: 'is 17 prime? reply as json' }],
};

/**
 * .what = a cache fake that records the marks the walk sets
 */
const genCacheFake = (input: { endpoints: OpenRouterEndpoint[] }) => {
  const marks: string[] = [];
  return {
    marks,
    sdkOpenRouterEndpoints: {
      getAllForModel: async () => input.endpoints,
      getAllJsonIgnoredTags: async () => [],
      delForModel: async () => {
        marks.push('delForModel');
      },
      setJsonIgnoredTag: async (mark: { tag: string }) => {
        marks.push(`setJsonIgnoredTag:${mark.tag}`);
      },
    },
  };
};

describe('getOneFloorCompletion.socket.integration', () => {
  jest.setTimeout(60_000);
  const fake = useBeforeAll(async () => genFakeOpenRouter());
  afterAll(() => new Promise<void>((done) => fake.server.close(() => done())));

  given(
    '[case1] a floor queue of a cut body, a stalled body, a 5xx, then a host that serves',
    () => {
      when('[t0] the walk runs over real sockets', () => {
        const walked = useThen('it settles', async () => {
          const openai = new OpenAI({ apiKey: 'test', baseURL: fake.baseURL });
          const cache = genCacheFake({ endpoints: [] });
          const result = await getOneFloorCompletion(
            {
              model: MODEL,
              request: REQUEST,
              filters: FILTERS_FLOOR,
              expectsJson: true,
              queue: [
                genEndpoint({ tag: 'cut', promptPerMillion: 0.01 }),
                genEndpoint({ tag: 'stall', promptPerMillion: 0.02 }),
                genEndpoint({ tag: 'down', promptPerMillion: 0.03 }),
                genEndpoint({ tag: 'serve', promptPerMillion: 0.04 }),
              ],
              attempts: [],
              retryAfter: null,
              faultLast: null,
              // .note = past the sdk's own retries of a 5xx (two, with backoff), so the
              //         5xx host reads as failed, never as a stall
              bound: { seconds: 6 },
            },
            { openai, sdkOpenRouterEndpoints: cache.sdkOpenRouterEndpoints },
          );
          return { result, marks: cache.marks };
        });

        then(
          'each faulted host is named by the fault its socket showed',
          () => {
            expect(walked.result.attempts).toEqual([
              { tag: 'cut', outcome: 'body-cut' },
              { tag: 'stall', outcome: 'stalled' },
              { tag: 'down', outcome: 'failed' },
            ]); // .note = the caller appends the served row; the walk reports only faults
          },
        );

        then('the host that served is the one admitted', () => {
          expect(walked.result.admitted.map((e) => e.tag)).toEqual(['serve']);
          expect(walked.result.response.choices[0]?.message.content).toEqual(
            '{"verdict":"yes"}',
          );
        });

        then('no transport fault marks a host in the cache', () => {
          expect(walked.marks).toEqual([]);
        });
      });
    },
  );

  given('[case2] a floor of only stalled hosts', () => {
    when('[t0] the walk runs over real sockets', () => {
      then('it stops after two stalls, and names the bound', async () => {
        const openai = new OpenAI({ apiKey: 'test', baseURL: fake.baseURL });
        const cache = genCacheFake({ endpoints: [] });
        const error = await getError(
          getOneFloorCompletion(
            {
              model: MODEL,
              request: REQUEST,
              filters: FILTERS_FLOOR,
              expectsJson: true,
              queue: [
                genEndpoint({ tag: 'stall', promptPerMillion: 0.01 }),
                genEndpoint({ tag: 'stall', promptPerMillion: 0.02 }),
                genEndpoint({ tag: 'stall', promptPerMillion: 0.03 }),
              ],
              attempts: [],
              retryAfter: null,
              faultLast: null,
              bound: { milliseconds: 300 },
            },
            { openai, sdkOpenRouterEndpoints: cache.sdkOpenRouterEndpoints },
          ),
        );
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(error.message).toContain('inside 300ms');
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given(
    '[case3] a supplied ask whose host spends its whole reply on thought',
    () => {
      when('[t0] the ask runs over a real socket', () => {
        then(
          'it ends in the all-thought error, by name, after one call',
          async () => {
            const openai = new OpenAI({
              apiKey: 'test',
              baseURL: fake.baseURL,
            });
            const cache = genCacheFake({
              endpoints: [
                genEndpoint({ tag: 'allthought', promptPerMillion: 0.01 }),
              ],
            });
            const error = await getError(
              getOneSuppliedCompletion(
                {
                  apiKey: 'test',
                  model: MODEL,
                  request: REQUEST,
                  filters: FILTERS_FLOOR,
                  paramsRequired: ['response_format', 'structured_outputs'],
                  expectsJson: true,
                  reasoning: null,
                },
                {
                  openai,
                  sdkOpenRouterEndpoints: cache.sdkOpenRouterEndpoints,
                },
              ),
            );
            expect(error).toBeInstanceOf(MalfunctionError);
            expect(
              error instanceof MalfunctionError ? error.metadata?.defect : null,
            ).toEqual('all-thought');
            expect(error.message).toContain('spent the whole reply on thought');
            expect(error.message).toMatchSnapshot();
          },
        );
      });
    },
  );

  // .why = issue #24: a host that answers 0 chars with `stop` where json was owed is marked
  //        under a cap too, since a room spent on thought ends `length`, never `stop`
  given(
    '[case4] a capped json ask whose cheapest host answers 0 chars with stop',
    () => {
      when('[t0] the walk runs over real sockets', () => {
        const walked = useThen('it settles', async () => {
          const openai = new OpenAI({ apiKey: 'test', baseURL: fake.baseURL });
          const cache = genCacheFake({ endpoints: [] });
          const result = await getOneFloorCompletion(
            {
              model: MODEL,
              request: { ...REQUEST, ...{ reasoning: { max_tokens: 600 } } },
              filters: FILTERS_FLOOR,
              expectsJson: true,
              queue: [
                genEndpoint({ tag: 'empty', promptPerMillion: 0.01 }),
                genEndpoint({ tag: 'serve', promptPerMillion: 0.02 }),
              ],
              attempts: [],
              retryAfter: null,
              faultLast: null,
              bound: { seconds: 6 },
            },
            { openai, sdkOpenRouterEndpoints: cache.sdkOpenRouterEndpoints },
          );
          return { result, marks: cache.marks };
        });

        then('the walk steps past the empty host to one that serves', () => {
          expect(walked.result.attempts).toEqual([
            { tag: 'empty', outcome: 'empty' },
          ]); // .note = the caller appends the served row
        });

        then('the empty host is marked, cap or no cap', () => {
          expect(walked.marks).toEqual(['setJsonIgnoredTag:empty']);
        });
      });
    },
  );
  // .why = case=9 with no floor: a cut body or a stall has no next hop in our hands, so
  //        it reaches the caller as a HostFaultError that names the admitted host
  const TEST_CASES_NO_FLOOR = [
    {
      description: '[case5] a no-floor ask whose admitted host cuts its body',
      given: { tag: 'cut' as const },
      expect: { fault: 'body-cut' },
    },
    {
      description: '[case6] a no-floor ask whose admitted host stalls its body',
      given: { tag: 'stall' as const },
      expect: { fault: 'stalled' },
    },
  ];
  TEST_CASES_NO_FLOOR.map((thisCase) =>
    given(thisCase.description, () => {
      when('[t0] the ask runs over a real socket', () => {
        then(
          'it ends in a HostFaultError that names the fault and the host',
          async () => {
            const openai = new OpenAI({
              apiKey: 'test',
              baseURL: fake.baseURL,
            });
            const cache = genCacheFake({ endpoints: [] });
            const error = await getError(
              getOneAdmittedSetCompletion(
                {
                  model: MODEL,
                  request: REQUEST,
                  expectsJson: true,
                  attempts: [],
                  retryAfter: null,
                  faultLast: null,
                  filters: { ...FILTERS_FLOOR, floor: false, privacy: 'full' },
                  qualified: [
                    genEndpoint({
                      tag: thisCase.given.tag,
                      promptPerMillion: 0.01,
                    }),
                  ],
                  bound: { milliseconds: 300 },
                },
                {
                  openai,
                  sdkOpenRouterEndpoints: cache.sdkOpenRouterEndpoints,
                },
              ),
            );
            expect(error).toBeInstanceOf(HostFaultError);
            expect(
              error instanceof HostFaultError ? error.fault : null,
            ).toEqual(thisCase.expect.fault);
            expect(error.message).toContain(thisCase.given.tag);
            expect(error.message).toMatchSnapshot();
          },
        );
      });
    }),
  );
});
