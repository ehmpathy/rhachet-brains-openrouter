import { ConstraintError } from 'helpful-errors';
import {
  asIsoPrice,
  asIsoPriceShape,
  type IsoPrice,
  priceMultiply,
  priceSub,
} from 'iso-price';
import OpenAI from 'openai';
import { given, then, useThen, when } from 'test-fns';

import { sdkOpenRouterEndpoints } from '../supply/sdkOpenRouterEndpoints';
import { getOneTierModel } from './getOneTierModel';
import { TIER_BY_BARE_SLUG } from './slug/AtomSlug.bare';
import { getAllAtomSlugs } from './slug/getAllAtomSlugs';

const API_KEY: string =
  process.env.OPENROUTER_API_KEY ??
  ConstraintError.throw(
    'OPENROUTER_API_KEY is required for integration tests',
    {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
      env: 'OPENROUTER_API_KEY',
    },
  );

const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const ALL_TIERS = getAllAtomSlugs();

/**
 * .what = is one price strictly below another
 * .why = the installed iso-price exposes no comparator; a negative difference is one
 */
const isPriceBelow = (input: { of: IsoPrice; below: IsoPrice }): boolean =>
  asIsoPriceShape(priceSub(input.of, input.below)).amount < 0n;

/**
 * .what = the context grains a spec may state, widest first
 * .why = hosts of one model differ by a few percent; a grain fits them all
 */
const CONTEXT_GRAINS = [1_000_000, 250_000, 200_000];

/**
 * .what = rounds a live window down to its grain, or keeps it if below all
 * .why = the spec never states more than a host serves
 */
const asContextGrain = (input: { tokens: number }): number =>
  CONTEXT_GRAINS.find((grain) => grain <= input.tokens) ?? input.tokens;

/**
 * .what = asks one model the cheapest question that still proves it serves
 * .why = a catalog read reports what a provider LISTS, never what it SERVES.
 *        so the probe must be a real completion
 *        (`rule.always.verify-model-ids-by-live-call`).
 */
const askOneLiveProbe = async (input: {
  model: string;
}): Promise<{ served: boolean; cause: string | null }> => {
  try {
    await openai.chat.completions.create({
      model: input.model,
      messages: [{ role: 'user', content: 'hi' }],
      // .note = some upstream providers reject max_tokens below 16
      max_tokens: 16,
    });
    return { served: true, cause: null };
  } catch (error) {
    // only an api refusal is a verdict on the model; a client bug or a network
    // fault is not, and rethrows untouched rather than read as "not served"
    if (!(error instanceof OpenAI.APIError)) throw error;

    // an account fault (bad key, no credits) says naught about the model, so
    // fail loud with the fix rather than report every tier as broken
    if (error.status === 401 || error.status === 402)
      throw new ConstraintError('openrouter account cannot pay for a probe', {
        status: error.status,
        cause: error,
        hint: 'check the key, then add credits at https://openrouter.ai/settings/credits',
      });

    return { served: false, cause: error.message };
  }
};

describe('BrainAtom.config.catalog.integration', () => {
  // .note = one probe per tier, sequential. a single call can take tens of
  //         seconds on a cold upstream, so the whole set needs headroom.
  jest.setTimeout(600000);

  // 🔴 .why = this suite is the rot detector. a tier reads its model from the
  //           live catalog, so a renamed model line, or a newest member that no
  //           host serves, has no diff in this repo. only a live pick plus a
  //           live call can catch it, on every integration pass
  given('[case1] every tier, picked from the live catalog', () => {
    // .note = the probe returns a WRAPPER object, never a bare array. `useThen`
    //         hands back a proxy that defers property access, and a proxy does
    //         not forward array methods
    const probed = useThen('each pick is probed with a live call', async () => {
      const results: {
        tier: string;
        model: string;
        served: boolean;
        cause: string | null;
      }[] = [];
      for (const tier of ALL_TIERS) {
        const model = await getOneTierModel(
          { tier, apiKey: API_KEY },
          { sdkOpenRouterEndpoints },
        );
        const outcome = await askOneLiveProbe({ model });
        results.push({ tier, model, ...outcome });
      }

      // record the verdict, so a reader can cite which tier broke, and on what
      console.log(
        [
          'openrouter tier liveness',
          ...results.map(
            (result) =>
              `  ${result.served ? '✔' : '✘'} ${result.tier} -> ${result.model}`,
          ),
        ].join('\n'),
      );

      return {
        picks: results.map((result) => ({
          tier: result.tier,
          model: result.model,
        })),
        dead: results
          .filter((result) => !result.served)
          .map((result) => `${result.tier} (${result.model}): ${result.cause}`),
      };
    });

    when('[t0] the probes return', () => {
      then('every tier picked a model', () => {
        // .why = guards the guard: an empty set passes the check below vacuously
        expect(probed.picks.length).toEqual(ALL_TIERS.length);
      });

      then('every tier pick serves a live call', () => {
        expect(probed.dead).toEqual([]);
      });

      then('every pick sits on its own tier line', () => {
        for (const pick of probed.picks)
          expect(
            TIER_BY_BARE_SLUG[
              pick.tier as (typeof ALL_TIERS)[number]
            ].line.test(pick.model),
          ).toEqual(true);
      });
    });
  });

  // .why = a tier `{author}/{tier}` wins over the unlisted read, so it would
  //        shadow an openrouter model of that exact id. none exists today; this
  //        fails loud the day one ships, rather than misroute in silence
  given('[case2] every tier name, against the live catalog', () => {
    when('[t0] the catalog ids are read', () => {
      const scene = useThen('the read succeeds', async () => {
        const ids = (
          await sdkOpenRouterEndpoints.getAllCatalogModels({ apiKey: API_KEY })
        ).map((model) => model.id);
        const bares = ALL_TIERS.map((slug) =>
          slug.replace(/^openrouter\//, ''),
        );
        return {
          idsCount: ids.length,
          baresCount: bares.length,
          shadowed: bares.filter((bare) => ids.includes(bare)),
        };
      });

      then('the catalog and the tier set are not empty', () => {
        // .why = guards the guard; an empty side passes the check below vacuously
        expect(scene.idsCount).toBeGreaterThan(100);
        expect(scene.baresCount).toBeGreaterThan(0);
      });

      then('no tier name shadows a real openrouter id', () => {
        expect(scene.shadowed).toEqual([]);
      });
    });
  });

  // .why = a tier spec is an estimate that must lean HIGH, so a caller who
  //        budgets by it is never surprised. the floor filter takes the cheapest
  //        qualified host, so the estimate must sit at or above the cheapest
  //        live input rate of the model the tier picked
  given('[case3] every tier rate estimate, against its pick live rates', () => {
    when('[t0] each pick endpoints are read', () => {
      const scene = useThen('the reads succeed', async () => {
        const rows = [];
        for (const tier of ALL_TIERS) {
          const model = await getOneTierModel(
            { tier, apiKey: API_KEY },
            { sdkOpenRouterEndpoints },
          );
          const estimate = priceMultiply({
            of: TIER_BY_BARE_SLUG[tier].spec.cost.cash.input,
            by: 1_000_000,
          });

          // read each live rate; an unpriced endpoint sets no bound
          const rates = (
            await sdkOpenRouterEndpoints.getAllForModel({
              model,
              apiKey: API_KEY,
            })
          )
            .map((endpoint) => endpoint.pricePromptUsdPerToken * 1e6)
            .filter((rate) => Number.isFinite(rate));
          if (!rates.length) {
            rows.push({
              line: `${tier} (${model}): no priced endpoint`,
              low: true,
            });
            continue;
          }

          // cast the bound at the boundary, then compare in iso-price
          const lowest = asIsoPrice(`$${Math.min(...rates).toFixed(6)}`);
          rows.push({
            line: `${tier} (${model}): estimate ${estimate}, cheapest live ${lowest}`,
            low: isPriceBelow({ of: estimate, below: lowest }),
          });
        }
        console.log(
          [
            'tier rate estimate vs cheapest live',
            ...rows.map((r) => r.line),
          ].join('\n'),
        );
        return {
          checked: rows.length,
          low: rows.filter((r) => r.low).map((r) => r.line),
        };
      });

      then('every tier was checked', () => {
        // .why = guards the guard; zero rows passes the check below vacuously
        expect(scene.checked).toEqual(ALL_TIERS.length);
      });

      then('no tier estimate sits below its cheapest live rate', () => {
        expect(scene.low).toEqual([]);
      });
    });
  });

  // .why = a tier spec states its pick's window, rounded down to a grain. hosts
  //        of one model differ by a few percent, so the grain fits each host;
  //        a new pick of a different grain fails here, loud
  given('[case4] every tier context, against its pick live window', () => {
    when('[t0] each pick context_length is read', () => {
      const scene = useThen('the reads succeed', async () => {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${API_KEY}` },
        });
        const body = (await response.json()) as {
          data: { id: string; context_length: number }[];
        };
        const rows = [];
        for (const tier of ALL_TIERS) {
          const model = await getOneTierModel(
            { tier, apiKey: API_KEY },
            { sdkOpenRouterEndpoints },
          );
          const live =
            body.data.find((entry) => entry.id === model)?.context_length ??
            null;
          const grain = live === null ? null : asContextGrain({ tokens: live });
          const spec = TIER_BY_BARE_SLUG[tier].spec.gain.size.context.tokens;
          rows.push({
            line: `${tier} (${model}): spec ${spec}, live ${live}, grain ${grain}`,
            off: grain !== spec,
          });
        }
        console.log(
          ['tier context spec vs live', ...rows.map((r) => r.line)].join('\n'),
        );
        return {
          checked: rows.length,
          off: rows.filter((r) => r.off).map((r) => r.line),
        };
      });

      then('every tier was checked', () => {
        // .why = guards the guard; zero rows passes the check below vacuously
        expect(scene.checked).toEqual(ALL_TIERS.length);
      });

      then('every tier spec states its pick window grain', () => {
        expect(scene.off).toEqual([]);
      });
    });
  });
});
