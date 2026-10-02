import { ConstraintError } from 'helpful-errors';
import { isIsoPrice, priceDivide, priceMultiply } from 'iso-price';
import { genContextBrainSupplier } from 'rhachet';
import { getSdkCredsFromBrainSupplies } from 'rhachet/brains';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import type { SupplyReport } from '../../domain.objects/SupplyReport';
import { sdkOpenRouterEndpoints } from '../supply/sdkOpenRouterEndpoints';
import type { BrainSuppliesOpenRouter } from './BrainAtom.config';
import { genBrainAtom } from './genBrainAtom';

const context = genContextBrainSupplier<'openrouter', BrainSuppliesOpenRouter>(
  'openrouter',
  { creds: { keyrack: { owner: 'ehmpath', env: 'test' } } },
);

const MODEL_DEEPSEEK_FLASH = 'deepseek/deepseek-v4.1-flash';

/**
 * .what = the openrouter api key, from the test keyrack
 * .why = case7 reads the live endpoint table to check the host that served
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

const outputSchema = z.object({ content: z.string() });
const prompt = 'reply with the single word: pong';

// a review-shaped ask: a long input, a short text reply
const promptLong = `${'the surfer paddles out past the break and waits for a set. '.repeat(1500)}\n\nreply with the single word: pong`;

/**
 * .what = reads the supply report the atom puts beside rhachet's declared output fields
 * .why = `supply` is not on rhachet's BrainOutput type, until rhachet declares a slot
 */
const asSupply = (output: unknown): SupplyReport =>
  (output as { supply: SupplyReport }).supply; // .note = supply rides beside the declared fields

/**
 * .what = the supply report with every live field masked, its shape kept
 * .why = the snapshot shows in review the record a caller audits as
 *        `output.supply`, yet the host, the hops, and the endpoint table move
 *        per call. the promise names and the token estimate are computed
 *        locally from the slug and the prompt, so they stay
 */
const asStableSupply = (input: { supply: SupplyReport }) => ({
  provider: input.supply.provider ? '(live host)' : null,
  generationId: input.supply.generationId ? '(live id)' : null,
  attempts: input.supply.attempts.length
    ? `(live hops; last = ${input.supply.attempts.at(-1)?.outcome})`
    : [],
  choice: input.supply.choice
    ? {
        tokensEstimate: input.supply.choice.tokensEstimate,
        funnel: input.supply.choice.funnel.map((step) => ({
          promise: step.promise,
          left: '(live count)',
        })),
        ranked: input.supply.choice.ranked.length
          ? `(live rows, keys: ${Object.keys(input.supply.choice.ranked[0]!).join(', ')})`
          : [],
      }
    : null,
});

describe('genBrainAtom.supply.integration', () => {
  jest.setTimeout(90000);

  given(
    '[case1] the agreed reviewer floor: floor&speed=min50tps&privacy=full',
    () => {
      const atom = genBrainAtom({
        slug: 'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full',
      });

      when('[t0] asked with a json schema', () => {
        const result = useThen('it answers', async () =>
          atom.ask(
            { role: {}, prompt, schema: { output: outputSchema } },
            context,
          ),
        );

        then('the answer is pong', () => {
          expect(result.output.content.toLowerCase()).toContain('pong');
        });

        then(
          'the supply names a provider, a generation id, and the choice',
          () => {
            const supply = asSupply(result);
            expect(supply.provider).toBeTruthy();
            expect(supply.generationId).toBeTruthy();
            expect(supply.attempts.at(-1)?.outcome).toEqual('served');
            expect(supply.choice?.funnel[0]?.promise).toEqual('all endpoints');
          },
        );

        then('the charge lands in metrics, above zero', () => {
          expect(
            isIsoPrice.greater(result.metrics.cost.cash.total, 'USD 0.00'),
          ).toEqual(true);
        });

        then('the supply report a caller audits matches snapshot', () => {
          expect(
            asStableSupply({ supply: asSupply(result) }),
          ).toMatchSnapshot();
        });

        then(
          'every endpoint ranked cheaper than the served one names the promise it failed',
          () => {
            const supply = asSupply(result);
            const servedTag = supply.attempts.at(-1)?.tag;
            const ranked = supply.choice?.ranked ?? [];
            const cheaper = ranked.slice(
              0,
              ranked.findIndex((r) => r.tag === servedTag),
            );
            cheaper
              .filter((r) => !supply.attempts.some((a) => a.tag === r.tag))
              .forEach((r) => expect(r.verdict).not.toEqual('qualified'));
          },
        );
      });
    },
  );

  given('[case2] the other speed form: speed.min=50tps', () => {
    const atom = genBrainAtom({
      slug: 'openrouter/deepseek/flash/floor&speed.min=50tps&privacy=full',
    });

    when('[t0] asked', () => {
      const result = useThen('it answers', async () =>
        atom.ask(
          { role: {}, prompt, schema: { output: outputSchema } },
          context,
        ),
      );

      then('it is supplied under the same promises', () => {
        const supply = asSupply(result);
        expect(supply.provider).toBeTruthy();
        expect(supply.choice?.funnel.map((f) => f.promise)).toContain(
          'speed>=50tps',
        );
      });

      then('the supply report a caller audits matches snapshot', () => {
        expect(asStableSupply({ supply: asSupply(result) })).toMatchSnapshot();
      });
    });
  });

  // 🔴 .why = wisher ruled 2026-10-02 (F31): a slug with no filters of its own
  //           takes our default supply filters — floor, ≥ 50 tps, full privacy —
  //           never openrouter's balancer
  given('[case3] the bare slug, via the default supply filters', () => {
    const atom = genBrainAtom({ slug: 'openrouter/deepseek/flash' });

    when('[t0] asked', () => {
      const result = useThen('it answers', async () =>
        atom.ask(
          { role: {}, prompt, schema: { output: outputSchema } },
          context,
        ),
      );

      then('the answer is pong', () => {
        expect(result.output.content.toLowerCase()).toContain('pong');
      });

      then(
        'the supply walks the floor, under the speed and privacy promises',
        () => {
          const supply = asSupply(result);
          const promises = supply.choice?.funnel.map((f) => f.promise) ?? [];
          expect(supply.provider).toBeTruthy();
          expect(supply.attempts.at(-1)?.outcome).toEqual('served');
          expect(promises).toContain('speed>=50tps');
          expect(promises).toContain('privacy=full (zdr list)');
        },
      );

      then('the supply report a caller audits matches snapshot', () => {
        expect(asStableSupply({ supply: asSupply(result) })).toMatchSnapshot();
      });
    });
  });

  given(
    '[case4] a review-shaped text ask on the floor: long input, z.string() reply',
    () => {
      const atom = genBrainAtom({
        slug: 'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full',
      });

      when('[t0] asked', () => {
        const result = useThen('it answers', async () =>
          atom.ask(
            { role: {}, prompt: promptLong, schema: { output: z.string() } },
            context,
          ),
        );

        then(
          'response_format is not required, so the funnel omits that promise',
          () => {
            const supply = asSupply(result);
            expect(supply.choice?.funnel.map((f) => f.promise)).not.toContain(
              'supports(response_format)',
            );
          },
        );

        then('the supply report a caller audits matches snapshot', () => {
          expect(
            asStableSupply({ supply: asSupply(result) }),
          ).toMatchSnapshot();
        });
      });
    },
  );

  // .why = case=23: `price.max` is proven by the bill. the charge must sit at or
  //        under every token billed at the bound — input and output alike
  given('[case5] a price bound: floor&price.max=1usd/M', () => {
    const atom = genBrainAtom({
      slug: 'openrouter/deepseek/flash/floor&price.max=1usd/M',
    });

    when('[t0] asked', () => {
      const result = useThen('it answers', async () =>
        atom.ask(
          { role: {}, prompt, schema: { output: outputSchema } },
          context,
        ),
      );

      then('the supply names the price promise', () => {
        const supply = asSupply(result);
        expect(supply.choice?.funnel.map((f) => f.promise)).toContain(
          'price.max=1usd/M',
        );
      });

      then('the charge is at or under every billed token at the bound', () => {
        const tokens = result.metrics.size.tokens;
        const tokensBilled =
          tokens.input + tokens.output + tokens.cache.get + tokens.cache.set;
        const bound = priceDivide({
          of: priceMultiply({ of: 'USD 1.00', by: tokensBilled }),
          by: 1_000_000,
        });
        expect(
          isIsoPrice.greater(result.metrics.cost.cash.total, bound),
        ).toEqual(false);
      });

      then('the supply report a caller audits matches snapshot', () => {
        expect(asStableSupply({ supply: asSupply(result) })).toMatchSnapshot();
      });
    });
  });

  // .why = without `floor`, the ask admits the whole qualified set at once
  //        (`provider.only` with several tags, no fallback). this proves that
  //        request shape against the live service: openrouter accepts it and a
  //        admitted host serves (the served-provider gate refuses any other)
  given('[case6] a filter with no floor: privacy=full', () => {
    const atom = genBrainAtom({
      slug: 'openrouter/deepseek/flash/privacy=full',
    });

    when('[t0] asked', () => {
      const result = useThen('it answers', async () =>
        atom.ask(
          { role: {}, prompt, schema: { output: outputSchema } },
          context,
        ),
      );

      then('the answer is pong', () => {
        expect(result.output.content.toLowerCase()).toContain('pong');
      });

      then('an admitted host served, with no walk', () => {
        const supply = asSupply(result);
        expect(supply.provider).toBeTruthy();
        expect(supply.attempts).toEqual([]);
        expect(supply.choice?.funnel.map((f) => f.promise)).toContain(
          'privacy=full (zdr list)',
        );
      });

      then('more than one endpoint was admitted', () => {
        const supply = asSupply(result);
        const qualified = (supply.choice?.ranked ?? []).filter(
          (row) => row.verdict === 'qualified',
        );
        expect(qualified.length).toBeGreaterThan(1);
      });

      then('the supply report a caller audits matches snapshot', () => {
        expect(asStableSupply({ supply: asSupply(result) })).toMatchSnapshot();
      });
    });
  });

  // .why = `precision=` sends openrouter's native `quantizations` field beside the
  //        admitted endpoint. this proves openrouter accepts the request shape, and that the host
  //        which served is one whose live endpoint row reads that quantization
  given('[case7] a precision promise: floor&precision=fp8', () => {
    const atom = genBrainAtom({
      slug: 'openrouter/deepseek/flash/floor&precision=fp8',
    });

    when('[t0] asked', () => {
      const scene = useThen('it answers', async () => {
        const result = await atom.ask(
          { role: {}, prompt, schema: { output: outputSchema } },
          context,
        );
        const supply = asSupply(result);
        const endpoints = await sdkOpenRouterEndpoints.getAllForModel({
          model: MODEL_DEEPSEEK_FLASH,
          apiKey: await getApiKey(),
        });
        const served = endpoints.find(
          (e) => e.tag === supply.attempts.at(-1)?.tag,
        );
        return {
          answer: result.output.content,
          supply,
          quantizationServed: served?.quantization ?? null,
        };
      });

      then('the answer is pong', () => {
        expect(scene.answer.toLowerCase()).toContain('pong');
      });

      then('the supply names the precision promise', () => {
        expect(scene.supply.choice?.funnel.map((f) => f.promise)).toContain(
          'precision=fp8',
        );
      });

      then('the host that served lists fp8 as its quantization', () => {
        expect(scene.supply.attempts.at(-1)?.outcome).toEqual('served');
        expect(scene.quantizationServed).toEqual('fp8');
      });

      then('the supply report a caller audits matches snapshot', () => {
        expect(asStableSupply({ supply: scene.supply })).toMatchSnapshot();
      });
    });
  });
});
