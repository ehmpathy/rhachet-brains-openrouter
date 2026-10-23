import { MalfunctionError } from 'helpful-errors';
import OpenAI from 'openai';
import { getError, given, then, useBeforeAll, useThen, when } from 'test-fns';

import { createServer } from 'node:http';
import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asSupplyFilters } from './asSupplyFilters';
import { getOneSuppliedCompletion } from './getOneSuppliedCompletion';

/**
 * .what = how the stub of openrouter answers a send routed to each host
 * .why = each case declares its hosts' behavior over real http
 *
 * .note = 'marked429' is openrouter's host error, which names the host;
 *         'markedUnnamed429' is that host error with no name;
 *         'normalized429' is openrouter's documented 429: no name, no mark (F8)
 */
type HostBehavior =
  | { serve: string }
  | 'marked429'
  | 'markedUnnamed429'
  | 'normalized429';

/**
 * .what = the provider name each stub tag belongs to
 * .why = a marked fault names the provider, never the tag
 */
const PROVIDER_BY_TAG: Record<string, string> = {
  cheap: 'Cheap',
  dear: 'Dear',
};

/**
 * .what = the http answer the stub gives for one host's behavior
 * .why = mirrors openrouter's wire shapes: a chat completion, or an error body
 *        `{ error: { code, message, metadata } }` with `retry-after` headers
 *
 * .note = `retry-after-ms: 1` keeps the openai client's own retries fast; it
 *         takes precedence over `retry-after`, which the refusal reports
 */
const asStubAnswer = (input: { tag: string; behavior: HostBehavior }) => {
  const headersThrottle = {
    'content-type': 'application/json',
    'retry-after-ms': '1',
    'retry-after': '3',
  };
  if (typeof input.behavior === 'object')
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: `gen-${input.tag}`,
        object: 'chat.completion',
        created: 1,
        model: 'deepseek/deepseek-v4.1-flash',
        provider: input.behavior.serve,
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
          cost: 0.00001,
        },
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'hi' },
          },
        ],
      },
    };
  if (input.behavior === 'markedUnnamed429')
    return {
      status: 429,
      headers: headersThrottle,
      body: {
        error: {
          code: 429,
          message: 'Provider returned error',
          metadata: {
            raw: JSON.stringify({
              error: { message: 'rate limited upstream' },
            }),
          },
        },
      },
    };
  if (input.behavior === 'marked429')
    return {
      status: 429,
      headers: headersThrottle,
      body: {
        error: {
          code: 429,
          message: 'Provider returned error',
          metadata: {
            provider_name: PROVIDER_BY_TAG[input.tag],
            raw: JSON.stringify({
              error: { message: 'rate limited upstream' },
            }),
          },
        },
      },
    };
  return {
    status: 429,
    headers: headersThrottle,
    body: {
      error: {
        code: 429,
        message: 'Rate limit exceeded',
        metadata: {
          error_type: 'rate_limit_exceeded',
          provider_code: 'rate_limited',
        },
      },
    },
  };
};

/**
 * .what = a local http stub of openrouter's chat endpoint, and a real openai
 *         client pointed at it
 * .why = the hop reads the real client's error: its status, the body's
 *        `metadata.provider_name`, and the `retry-after` header. only the real
 *        client, over real http, proves those field paths and its own retries
 *
 * .note = each send routes to the first tag in `provider.only`, as the fakes do
 *
 * .mock = openrouter's chat endpoint, as a local http server
 * .why = a host fault cannot be made on demand: openrouter throttles, refuses, or
 *        names a host only when a real host does. the cases here need a named 429,
 *        an unnamed marked 429, openrouter's own 429, and a `retry-after` header,
 *        each on cue. the client, the http, and the error parse stay real
 * .real = live sends through the same supply path:
 *         `src/domain.operations/atom/genBrainAtom.supply.integration.test.ts` [case6]
 *         (no floor, admitted set) and
 *         `src/contract/sdk/getBrainAtomsByOpenRouter.acceptance.test.ts`
 */
const genOpenRouterStub = async (input: {
  behaviorByTag: Record<string, HostBehavior>;
}) => {
  const sends: string[][] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const request: { provider: { only: string[] } } = JSON.parse(
        Buffer.concat(chunks).toString('utf8'),
      );
      sends.push(request.provider.only);
      const tag = request.provider.only[0]!;
      const behavior = input.behaviorByTag[tag];
      if (!behavior) {
        res.writeHead(500).end(`stub: no behavior declared for tag ${tag}`); // a fixture defect, never a host fault
        return;
      }
      const answer = asStubAnswer({ tag, behavior });
      res.writeHead(answer.status, answer.headers);
      res.end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('stub: a tcp listen yielded no port'); // a fixture defect, never a host fault
  const openai = new OpenAI({
    apiKey: 'stub',
    baseURL: `http://127.0.0.1:${address.port}/api/v1`, // .note = the client's default maxRetries (2) is kept, as genBrainAtom keeps it
  });
  const close = () => new Promise<void>((done) => server.close(() => done()));
  return { openai, sends, close };
};

const genEndpoint = (input: {
  tag: string;
  pricePerMillion: number;
}): OpenRouterEndpoint => ({
  providerName: PROVIDER_BY_TAG[input.tag]!,
  tag: input.tag,
  quantization: 'fp8',
  supportedParameters: ['response_format', 'tools'],
  pricePromptUsdPerToken: input.pricePerMillion / 1e6,
  priceCompletionUsdPerToken: input.pricePerMillion / 1e6,
  throughputTps: 90,
  zdr: true,
});

/**
 * .what = a fake endpoint cache that serves a fixed list
 * .why = the endpoint list is not under test here; the chat send is
 *
 * .mock = `sdkOpenRouterEndpoints`
 * .why = the hop needs a fixed, known set of hosts to route to; the live list
 *        moves per day and cannot name which tag a stub host plays
 * .real = `src/domain.operations/supply/sdkOpenRouterEndpoints.integration.test.ts`
 *         reads the live endpoints, the cache, and the drop
 */
const genSdkFake = () => ({
  getAllForModel: async () => [
    genEndpoint({ tag: 'cheap', pricePerMillion: 0.1 }),
    genEndpoint({ tag: 'dear', pricePerMillion: 0.9 }),
  ],
  delForModel: async () => undefined,
  getAllJsonIgnoredTags: async () => [],
  setJsonIgnoredTag: async () => undefined,
});

const REQUEST = {
  model: 'deepseek/deepseek-v4.1-flash',
  messages: [{ role: 'user' as const, content: 'hi' }],
};

/**
 * .what = supplies one filtered ask with no floor, through the stub
 * .why = the admitted-set path is the one #21 broke
 */
const runSupply = async (input: { openai: OpenAI }) =>
  getOneSuppliedCompletion(
    {
      apiKey: 'stub',
      model: REQUEST.model,
      request: REQUEST,
      filters: asSupplyFilters({ segment: 'privacy=full' }),
      paramsRequired: [],
      expectsJson: false,
    },
    { openai: input.openai, sdkOpenRouterEndpoints: genSdkFake() },
  );

describe('getOneSuppliedCompletion, through a real openai client (#21)', () => {
  given('[case1] the cheaper host throttles, marked with its name', () => {
    const stub = useBeforeAll(async () =>
      genOpenRouterStub({
        behaviorByTag: { cheap: 'marked429', dear: { serve: 'Dear' } },
      }),
    );
    afterAll(async () => stub.close());

    when('[t0] a filtered ask with no floor is supplied', () => {
      const result = useThen('it serves', async () =>
        runSupply({ openai: stub.openai }),
      );

      then(
        'the client retries the set twice, then the hop drops the host',
        () => {
          expect(stub.sends).toEqual([
            ['cheap', 'dear'],
            ['cheap', 'dear'],
            ['cheap', 'dear'],
            ['dear'],
          ]);
        },
      );

      then('the host left in the set serves', () => {
        expect(result.supply.provider).toEqual('Dear');
      });

      then('the report names the hop, then the serve', () => {
        expect(result.supply.attempts).toEqual([
          { tag: 'cheap', outcome: 'throttled' },
          { tag: 'dear', outcome: 'served' },
        ]);
      });
    });
  });

  // .why = c9: the normalized 429 is openrouter's own account limit. no other
  //        host can fix it, so it fails after the client's own retries alone
  given("[case2] openrouter's normalized 429, which marks no host", () => {
    const stub = useBeforeAll(async () =>
      genOpenRouterStub({
        behaviorByTag: { cheap: 'normalized429', dear: { serve: 'Dear' } },
      }),
    );
    afterAll(async () => stub.close());

    when('[t0] a filtered ask with no floor is supplied', () => {
      const scene = useThen('it fails loud', async () => {
        const error = await getError(runSupply({ openai: stub.openai }));
        // .note = plain data; an Error's message does not survive the proxy
        return {
          isRateLimit: error instanceof OpenAI.RateLimitError,
          message: error.message,
        };
      });

      then('the 429 rethrows untouched, as the real client raised it', () => {
        expect(scene.isRateLimit).toEqual(true);
        expect(scene.message).toContain('Rate limit exceeded');
      });

      then('only the client retried the set; no host was walked', () => {
        expect(stub.sends).toEqual([
          ['cheap', 'dear'],
          ['cheap', 'dear'],
          ['cheap', 'dear'],
        ]);
      });
    });
  });

  // .why = #21's own message is `429 Provider returned error`: a host's throttle.
  //        marked yet unnamed, no host can be dropped, so the set is walked
  given('[case4] a host throttles, marked, with no name', () => {
    const stub = useBeforeAll(async () =>
      genOpenRouterStub({
        behaviorByTag: { cheap: 'markedUnnamed429', dear: { serve: 'Dear' } },
      }),
    );
    afterAll(async () => stub.close());

    when('[t0] a filtered ask with no floor is supplied', () => {
      const result = useThen('it serves', async () =>
        runSupply({ openai: stub.openai }),
      );

      then('the set is retried by the client, then walked host by host', () => {
        expect(stub.sends).toEqual([
          ['cheap', 'dear'],
          ['cheap', 'dear'],
          ['cheap', 'dear'],
          ['cheap'],
          ['cheap'],
          ['cheap'],
          ['dear'],
        ]);
        expect(result.supply.provider).toEqual('Dear');
      });

      then('the report names the throttle the walk stepped past', () => {
        expect(result.supply.attempts).toEqual([
          { tag: 'cheap', outcome: 'throttled' },
          { tag: 'dear', outcome: 'served' },
        ]);
      });
    });
  });

  given('[case3] every host throttles', () => {
    const stub = useBeforeAll(async () =>
      genOpenRouterStub({
        behaviorByTag: { cheap: 'marked429', dear: 'marked429' },
      }),
    );
    afterAll(async () => stub.close());

    when('[t0] a filtered ask with no floor is supplied', () => {
      const scene = useThen('it fails loud', async () => {
        const error = await getError(runSupply({ openai: stub.openai }));
        const cause = 'cause' in error ? error.cause : undefined;
        // .note = plain data; an Error's message does not survive the proxy
        return {
          isMalfunction: error instanceof MalfunctionError,
          message: error.message,
          causeStatus: cause instanceof OpenAI.APIError ? cause.status : null,
        };
      });

      then(
        'the set is retried, then the named host dropped and retried',
        () => {
          expect(stub.sends).toEqual([
            ['cheap', 'dear'],
            ['cheap', 'dear'],
            ['cheap', 'dear'],
            ['dear'],
            ['dear'],
            ['dear'],
          ]);
        },
      );

      then('it is a MalfunctionError that lists each hop', () => {
        expect(scene.isMalfunction).toEqual(true);
        expect(scene.message).toContain('throttled cheap');
        expect(scene.message).toContain('throttled dear');
      });

      then(
        "it names openrouter's retry-after, read off the real header",
        () => {
          expect(scene.message).toContain('retry after 3s');
        },
      );

      then(
        "it shows the last host's own reason, and keeps its error as cause",
        () => {
          expect(scene.message).toContain(
            'last host fault: rate limited upstream',
          );
          expect(scene.causeStatus).toEqual(429);
        },
      );
    });
  });
});
