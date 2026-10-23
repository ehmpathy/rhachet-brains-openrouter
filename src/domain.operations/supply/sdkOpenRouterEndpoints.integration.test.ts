import { existsSync, promises as fs, readFileSync } from 'fs';
import { ConstraintError } from 'helpful-errors';
import OpenAI from 'openai';
import os from 'os';
import path from 'path';
import { getSdkCredsFromBrainSupplies } from 'rhachet/brains';
import { given, then, useBeforeAll, useThen, when } from 'test-fns';

import { asOpenRouterExtras } from './asOpenRouterExtras';
import { sdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';

const MODEL = 'deepseek/deepseek-v4.1-flash';
const CACHE_DIR = path.join(
  os.homedir(),
  '.rhachet/storage/repo=openrouter/role=any/cache',
);

/**
 * .what = the openrouter api key, from the test keyrack
 * .why = these reads are live; an absent key fails loud with the fix
 */
const getApiKey = async (): Promise<string> => {
  const creds = await getSdkCredsFromBrainSupplies({
    creds: { keyrack: { owner: 'ehmpath', env: 'test' } },
    keys: ['OPENROUTER_API_KEY'],
  });
  const apiKey = creds.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new ConstraintError('OPENROUTER_API_KEY required for this test', {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
    });
  return apiKey;
};

/**
 * .what = how long the javascript thread has waited in the cpu run queue, in ms
 * .why = on a shared host, wall-clock time counts the wait for a free core,
 *        which other processes set; the kernel reports it apart, per thread
 *        (/proc/self/task/<tid>/schedstat, field 2, ns). the main thread's tid
 *        is the pid; /proc/self/schedstat would sum the libuv pool threads too
 *
 * .note = read sync, on the thread it measures: an async read would wait on
 *         the event loop outside the timed window, and count that wait twice
 * .note = off linux the file is absent, so the wait reads 0 and the bound
 *         falls back to plain wall-clock time: stricter, never looser
 */
const SCHEDSTAT_PATH = `/proc/self/task/${process.pid}/schedstat`;
const getOneRunQueueWaitMs = (): number => {
  if (!existsSync(SCHEDSTAT_PATH)) return 0;
  const schedstat = readFileSync(SCHEDSTAT_PATH, 'utf8');
  return Number(schedstat.split(' ')[1]) / 1_000_000;
};

/**
 * .note = probed 2026-10-02: openrouter serves no per-model zdr read.
 *         `/endpoints/zdr?model=`, `?model_id=`, `?models=`, and
 *         `/models/{id}/endpoints/zdr` all 404; `/models/{id}/endpoints?zdr=true`
 *         ignores the flag (33 of 33 rows). only `/endpoints/zdr` serves —
 *         1,170,442 bytes, 925 rows, 27 for this model. hence the slim index.
 */
describe('sdkOpenRouterEndpoints.integration', () => {
  // .why = above case4's 120s per-ask deadline, so the deadline fires first
  jest.setTimeout(180_000);
  const apiKey = useBeforeAll(async () => ({ value: await getApiKey() }));

  given('[case1] the live endpoints of deepseek-v4.1-flash', () => {
    when('[t0] the endpoints are read', () => {
      const scene = useThen('the read succeeds', async () => ({
        endpoints: await sdkOpenRouterEndpoints.getAllForModel({
          model: MODEL,
          apiKey: apiKey.value,
        }),
      }));

      then('each endpoint reports price, speed, and params', () => {
        expect(scene.endpoints.length).toBeGreaterThan(0);
        for (const endpoint of scene.endpoints) {
          expect(Number.isFinite(endpoint.pricePromptUsdPerToken)).toEqual(
            true,
          );
          expect(Array.isArray(endpoint.supportedParameters)).toEqual(true);
        }
      });

      then(
        'each endpoint carries its zdr membership, and the list holds both kinds',
        () => {
          // .why = measured 2026-10-01: 27 of 33 on the zdr list for this model
          const zdrCount = scene.endpoints.filter((e) => e.zdr).length;
          expect(zdrCount).toBeGreaterThan(0);
          expect(zdrCount).toBeLessThan(scene.endpoints.length);
        },
      );
    });
  });

  given('[case2] a warm cache', () => {
    when('[t0] the same reads run again', () => {
      const scene = useThen('they return from memory', async () => {
        await sdkOpenRouterEndpoints.getAllForModel({
          model: MODEL,
          apiKey: apiKey.value,
        });
        const fetchSpy = jest.spyOn(globalThis, 'fetch');
        const timeOneWarmRead = async (): Promise<number> => {
          const queueBefore = getOneRunQueueWaitMs();
          const wallBefore = Date.now();
          await sdkOpenRouterEndpoints.getAllForModel({
            model: MODEL,
            apiKey: apiKey.value,
          });
          const wallMs = Date.now() - wallBefore;
          const queueMs = getOneRunQueueWaitMs() - queueBefore;
          return wallMs - queueMs;
        };
        // reads in sequence, so each is timed alone
        const timeWarmReads = async (count: number): Promise<number[]> =>
          count === 0
            ? []
            : [await timeOneWarmRead(), ...(await timeWarmReads(count - 1))];
        const activeMsAll = await timeWarmReads(10);
        const fetchCalls = fetchSpy.mock.calls.length;
        fetchSpy.mockRestore();
        return { activeMsSlowest: Math.max(...activeMsAll), fetchCalls };
      });

      then('no network read is made', () => {
        expect(scene.fetchCalls).toEqual(0);
      });

      // .why = a warm read returns within 50ms, on every read of ten. the time
      //        counted is wall-clock less the time the thread sat in the cpu run
      //        queue: on a shared host that wait is other processes' load (load
      //        average 73 on 12 cores measured 2026-10-23, `setTimeout(0)` late by
      //        up to 31ms) and no property of the cache. a slow read or an i/o stall
      //        still counts in full, since a thread that waits on i/o is not queued
      then('every warm read returns within 50ms', () => {
        expect(scene.activeMsSlowest).toBeLessThan(50);
      });
    });

    when('[t1] the cache directory is read', () => {
      const scene = useThen('it lists its files', async () => {
        const names = await fs.readdir(CACHE_DIR);
        const bodies = await Promise.all(
          names.map((name) =>
            fs.readFile(path.join(CACHE_DIR, name), 'utf8').catch(() => ''),
          ),
        );
        return { names, bodies };
      });

      then('the api key is in no file name and no file body', () => {
        for (const name of scene.names)
          expect(name).not.toContain(apiKey.value);
        for (const body of scene.bodies)
          expect(body).not.toContain(apiKey.value);
      });
    });
  });

  given("[case3] a model's endpoints entry is dropped (case=21)", () => {
    when('[t0] a fleet of twelve asks reads it at once, cold', () => {
      const scene = useThen('each read succeeds', async () => {
        // drop the entry, so the next read must go live
        await sdkOpenRouterEndpoints.delForModel({ model: MODEL });

        // spy, never mock: the reads are real; only the count is observed
        const fetchSpy = jest.spyOn(globalThis, 'fetch');
        const results = await Promise.all(
          Array.from({ length: 12 }, () =>
            sdkOpenRouterEndpoints.getAllForModel({
              model: MODEL,
              apiKey: apiKey.value,
            }),
          ),
        );
        const endpointReads = fetchSpy.mock.calls.filter(([url]) =>
          String(url).includes(`/models/${MODEL}/endpoints`),
        ).length;
        fetchSpy.mockRestore();
        return {
          endpointReads,
          sizes: results.map((endpoints) => endpoints.length),
        };
      });

      then('the drop forced a live read', () => {
        expect(scene.endpointReads).toBeGreaterThan(0);
      });

      then('one live read serves all twelve (Q19)', () => {
        expect(scene.endpointReads).toEqual(1);
      });

      then('every ask received the same list', () => {
        expect(new Set(scene.sizes).size).toEqual(1);
        expect(scene.sizes[0]).toBeGreaterThan(0);
      });
    });

    when('[t1] a model with no entry is dropped', () => {
      then('it is a no-op, never an error', async () => {
        await sdkOpenRouterEndpoints.delForModel({
          model: 'acme/absent-model',
        });
        await sdkOpenRouterEndpoints.delForModel({
          model: 'acme/absent-model',
        });
      });
    });
  });

  // .why = the provider gate (`getOneServedEndpoint`) compares the response's
  //        `provider` to the admitted endpoint's `provider_name`. if the two ever
  //        spell one host two ways, every filtered ask on that host is withheld (Q20)
  given('[case4] each endpoint of deepseek-v4.1-flash, admitted alone', () => {
    when('[t0] each is asked for one token', () => {
      const scene = useThen('the asks complete', async () => {
        const endpoints = await sdkOpenRouterEndpoints.getAllForModel({
          model: MODEL,
          apiKey: apiKey.value,
        });
        // .note = each ask is bounded end to end: one slow host must not stall the
        //         case past jest's limit. the sdk `timeout` stops at the headers, so
        //         a host that stalls its body hangs past it; the race below bounds
        //         the body too, and the abort frees the socket. a slow or refused
        //         host proves naught, so it settles to null
        const openai = new OpenAI({
          apiKey: apiKey.value,
          baseURL: 'https://openrouter.ai/api/v1',
          maxRetries: 0,
        });
        const ASK_DEADLINE_MS = 120_000; // a slow host may take this long on its body
        const outcomes = await Promise.all(
          endpoints.map(async (endpoint) => {
            const abort = new AbortController();
            const deadline = new Promise<null>((settle) =>
              setTimeout(() => {
                abort.abort();
                settle(null);
              }, ASK_DEADLINE_MS).unref(),
            );
            const ask = openai.chat.completions
              .create(
                {
                  model: MODEL,
                  messages: [{ role: 'user', content: 'reply: ok' }],
                  max_tokens: 1,
                  ...{
                    provider: {
                      only: [endpoint.tag],
                      allow_fallbacks: false,
                    },
                  },
                },
                { signal: abort.signal },
              )
              .catch((error: unknown) =>
                error instanceof OpenAI.APIError || abort.signal.aborted
                  ? null
                  : Promise.reject(error),
              );
            const response = await Promise.race([ask, deadline]);
            // a refused endpoint proves naught, so it is left out (undefined)
            return {
              tag: endpoint.tag,
              expected: endpoint.providerName,
              detected: response
                ? asOpenRouterExtras({ response }).provider
                : undefined,
            };
          }),
        );
        return { outcomes: outcomes.filter((o) => o.detected !== undefined) };
      });

      then('most endpoints served', () => {
        // .why = guards the guard; a throttled or refused endpoint proves naught
        expect(scene.outcomes.length).toBeGreaterThan(5);
      });

      then("each served response names its endpoint's provider_name", () => {
        const mismatched = scene.outcomes.filter(
          (o) => o.detected !== o.expected,
        );
        expect(mismatched).toEqual([]);
      });
    });
  });

  // .why = case=11: a read the promises need fails loud, as the system's fault,
  //        and is never cached — so no empty list can pose as "no endpoints"
  given('[case5] an endpoints read openrouter refuses', () => {
    const MODEL_ABSENT = 'acme/absent-model-for-a-read-failure';

    when('[t0] the read runs twice', () => {
      const scene = useThen('each read fails', async () => {
        const errors = await Promise.all(
          [1, 2].map(() =>
            sdkOpenRouterEndpoints
              .getAllForModel({ model: MODEL_ABSENT, apiKey: apiKey.value })
              .then(() => null)
              .catch((error: Error) => error),
          ),
        );
        // .note = plain data; an Error's fields do not survive the proxy
        return {
          classes: errors.map((e) => e?.constructor.name ?? null),
          messages: errors.map((e) => e?.message ?? null),
        };
      });

      then('each read is a MalfunctionError, never an empty list', () => {
        expect(scene.classes).toEqual(['MalfunctionError', 'MalfunctionError']);
      });

      then('the message names the read and says a retry is safe', () => {
        expect(scene.messages[0]).toContain(
          `/models/${MODEL_ABSENT}/endpoints`,
        );
        expect(scene.messages[0]).toContain('a retry is safe');
      });

      // .note = the headline only: the metadata below it holds openrouter's
      //         own response body, which is live and may change any day
      then('the headline a human reads matches snapshot', () => {
        expect(scene.messages[0]?.split('\n')[0]).toMatchSnapshot();
      });
    });
  });
});
