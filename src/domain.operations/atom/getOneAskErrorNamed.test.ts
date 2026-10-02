import { ConstraintError } from 'helpful-errors';
import { asIsoDateStamp, asIsoTimeStamp } from 'iso-time';
import OpenAI from 'openai';
import { given, then, useThen, when } from 'test-fns';

import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';
import { getOneAskErrorNamed } from './getOneAskErrorNamed';

/**
 * .what = an api error as the openai client raises it for a given status
 * .why = the classifiers key on `OpenAI.APIError` + status; the real class only
 */
const genApiError = (input: { status: number; message: string }) =>
  new OpenAI.APIError(input.status, undefined, input.message, new Headers());

/**
 * .what = a fake catalog sdk that counts its reads
 * .why = the catalog read is injected so a test can see whether it ran
 */
const genSdk = (input: { catalog: OpenRouterCatalogModel[] }) => {
  const reads: string[] = [];
  return {
    reads,
    sdkOpenRouterEndpoints: {
      getAllCatalogModels: async (args: { apiKey: string }) => {
        reads.push(args.apiKey);
        return input.catalog;
      },
    },
  };
};

const CATALOG: OpenRouterCatalogModel[] = [
  { id: 'qwen/qwen3-max', expiresOn: asIsoDateStamp('2026-01-09') },
  { id: 'qwen/qwen3.6-max', expiresOn: null },
].map((model) => ({
  ...model,
  createdAt: asIsoTimeStamp('2026-01-01T00:00:00.000Z'),
}));

const runOne = (input: { error: unknown; model: string }) => {
  const sdk = genSdk({ catalog: CATALOG });
  return getOneAskErrorNamed(
    {
      error: input.error,
      model: input.model,
      filterSuffix: '/floor',
      apiKey: 'key-test',
    },
    sdk,
  ).then((named) => ({ named, reads: sdk.reads.length }));
};

describe('getOneAskErrorNamed', () => {
  given('[case1] a 402 from openrouter', () => {
    when('[t0] the error is named', () => {
      const result = useThen('it resolves', () =>
        runOne({
          error: genApiError({
            status: 402,
            message: '402 Insufficient credits',
          }),
          model: 'qwen/qwen3.6-max',
        }),
      );
      then('it names the account fault', () => {
        expect(result.named).toBeInstanceOf(ConstraintError);
      });
      then('it reads no catalog', () => {
        expect(result.reads).toEqual(0);
      });
    });
  });

  given('[case2] a 404 for a model the catalog dated past', () => {
    when('[t0] the error is named', () => {
      const result = useThen('it resolves', () =>
        runOne({
          error: genApiError({ status: 404, message: '404 Not Found' }),
          model: 'qwen/qwen3-max',
        }),
      );
      then('it names the withdrawal with the nearest live id', () => {
        expect(result.named).toBeInstanceOf(ConstraintError);
        const message =
          result.named instanceof Error ? result.named.message : '';
        expect(message).toContain('openrouter/qwen/qwen3.6-max/floor');
      });
      then('it reads the catalog once', () => {
        expect(result.reads).toEqual(1);
      });
    });
  });

  given('[case3] a 404 for a model the catalog still serves', () => {
    const error = genApiError({ status: 404, message: '404 Not Found' });
    when('[t0] the error is named', () => {
      const result = useThen('it resolves', () =>
        runOne({ error, model: 'qwen/qwen3.6-max' }),
      );
      then('it returns the original error, untouched', () => {
        expect(result.named).toBe(error);
      });
    });
  });

  given(
    '[case4] an error that is neither an account fault nor a refusal',
    () => {
      const error = genApiError({ status: 500, message: '500 upstream' });
      when('[t0] the error is named', () => {
        const result = useThen('it resolves', () =>
          runOne({ error, model: 'qwen/qwen3.6-max' }),
        );
        then('it returns the original error, untouched', () => {
          expect(result.named).toBe(error);
        });
        then('it reads no catalog', () => {
          expect(result.reads).toEqual(0);
        });
      });
    },
  );

  given('[case5] a throw that is not an Error', () => {
    when('[t0] the error is named', () => {
      const result = useThen('it resolves', () =>
        runOne({ error: 'a bare string', model: 'qwen/qwen3.6-max' }),
      );
      then('it returns the throw as it came', () => {
        expect(result.named).toEqual('a bare string');
      });
    });
  });
});
