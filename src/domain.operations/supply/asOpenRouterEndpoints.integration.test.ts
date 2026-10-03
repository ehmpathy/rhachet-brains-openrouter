import { ConstraintError } from 'helpful-errors';
import OpenAI from 'openai';
import { given, then, useThen, when } from 'test-fns';

import { sdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';

const API_KEY: string =
  process.env.OPENROUTER_API_KEY ??
  ConstraintError.throw(
    'OPENROUTER_API_KEY is required for integration tests',
    {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
      env: 'OPENROUTER_API_KEY',
    },
  );

const MODEL = 'deepseek/deepseek-v4.1-flash';

/**
 * .what = the hosts of a model that list a discount, read raw
 * .why = `discount` is not cast into our endpoint shape; this check reads it
 *        straight from openrouter to find a host where it is nonzero
 */
const getAllDiscountedTags = async (): Promise<string[]> => {
  const response = await fetch(
    `https://openrouter.ai/api/v1/models/${MODEL}/endpoints`,
  );
  const body = (await response.json()) as {
    data: { endpoints: { tag: string; pricing: { discount?: number } }[] };
  };
  return body.data.endpoints
    .filter((endpoint) => (endpoint.pricing.discount ?? 0) > 0)
    .map((endpoint) => endpoint.tag);
};

describe('asOpenRouterEndpoints.integration', () => {
  jest.setTimeout(180_000);

  // 🔴 .why = the floor ranks by `pricing.prompt` alone. a host can also list a
  //           `discount`; measured 2026-10-03, the listed rate already holds it
  //           (deepinfra 0.3, novita 0.2, streamlake 0.53: charged ÷ listed =
  //           1.000). if openrouter ever lists the rate before the discount, the
  //           floor misranks those hosts in silence. this fails it, loud
  given('[case1] a host that lists a discount', () => {
    when('[t0] it is asked one prompt, pinned alone', () => {
      const scene = useThen('the ask succeeds', async () => {
        const tags = await getAllDiscountedTags();
        const endpoints = await sdkOpenRouterEndpoints.getAllForModel({
          model: MODEL,
          apiKey: API_KEY,
        });
        const openai = new OpenAI({
          apiKey: API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
          maxRetries: 0,
        });

        // try each discounted host until one serves; a throttle is not a verdict
        for (const tag of tags) {
          const endpoint = endpoints.find((entry) => entry.tag === tag);
          if (!endpoint) continue;
          const response = await openai.chat.completions
            .create({
              model: MODEL,
              // .why = a fresh prefix per run, so no cache read skews the rate
              messages: [
                {
                  role: 'user',
                  content: `${Date.now()} ${'say pong. '.repeat(2000)}`,
                },
              ],
              max_tokens: 16,
              // @ts-expect-error openrouter's own route field, absent from the openai sdk type
              provider: { only: [tag], allow_fallbacks: false },
              usage: { include: true },
            })
            .catch((error: unknown) => {
              if (error instanceof OpenAI.APIError) return null;
              throw error;
            });
          if (!response) continue;
          const usage = response.usage as OpenAI.CompletionUsage & {
            cost: number;
            prompt_tokens_details?: { cached_tokens?: number };
          };
          if (usage.prompt_tokens_details?.cached_tokens) continue;
          const listed =
            usage.prompt_tokens * endpoint.pricePromptUsdPerToken +
            usage.completion_tokens * endpoint.priceCompletionUsdPerToken;
          return { tag, ratio: usage.cost / listed };
        }
        return { tag: null, ratio: null };
      });

      then('a discounted host served', () => {
        // .why = guards the guard; no host served passes the check below vacuously
        expect(scene.tag).not.toEqual(null);
      });

      then(
        'the charge equals the listed rate, so the rate holds the discount',
        () => {
          expect(scene.ratio).toBeCloseTo(1, 2);
        },
      );
    });
  });
});
