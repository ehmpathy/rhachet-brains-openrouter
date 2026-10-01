import { BadRequestError } from 'helpful-errors';
import OpenAI from 'openai';
import { given, then, useThen, when } from 'test-fns';

import {
  type BrainAtomSlugFireworksPinned,
  CONFIG_BY_ATOM_SLUG,
} from './BrainAtom.config';
import { isRetiredAtomSlug } from './slug/AtomSlug.retired';

if (!process.env.FIREWORKS_API_KEY)
  throw new BadRequestError(
    'FIREWORKS_API_KEY is required for integration tests',
    {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
      env: 'FIREWORKS_API_KEY',
    },
  );

const openai = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: 'https://api.fireworks.ai/inference/v1',
});

const ALL_SLUGS = Object.keys(
  CONFIG_BY_ATOM_SLUG,
) as BrainAtomSlugFireworksPinned[];

/**
 * .what = asks one model the cheapest question that still proves it serves
 * .why = a catalog read reports what fireworks LISTS, never what it SERVES.
 *        verified 2026-09-16: `deepseek-v4-pro`, `qwen3p7-plus`, and
 *        `minimax-m2p7` were each returned by the models api and each answered
 *        404 on inference. so the probe must be a real completion.
 */
const askOneLiveProbe = async (input: {
  model: string;
}): Promise<{ served: boolean; cause: string | null }> => {
  try {
    await openai.chat.completions.create({
      model: input.model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    });
    return { served: true, cause: null };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { served: false, cause: error.message };
  }
};

describe('BrainAtom.config.catalog.integration', () => {
  // .note = one probe per model, sequential. observed single-call latency on
  //         fireworks ranges 1-28s, so the whole catalog needs real headroom.
  jest.setTimeout(600000);

  given('[case1] every model id declared in the catalog', () => {
    // .why = this suite is the rot detector. a provider may retire an id, move
    //        an alias, or drop a model from serverless with no diff in this
    //        repo — so no unit test and no type can catch it. only a live call
    //        can, and it must run on every integration pass or the catalog
    //        rots silently. measured: the prior catalog carried 3 dead ids for
    //        a month before anyone asked it a question.
    // .note = the probe returns a WRAPPER object, never a bare array. `useThen`
    //         hands back a proxy that defers property access, and a proxy does
    //         not forward array methods — `probed.filter` throws. a named field
    //         sidesteps that entirely.
    const probed = useThen('each is probed with a live call', async () => {
      const results: {
        slug: BrainAtomSlugFireworksPinned;
        model: string;
        served: boolean;
        cause: string | null;
      }[] = [];
      for (const slug of ALL_SLUGS) {
        const { model } = CONFIG_BY_ATOM_SLUG[slug];
        const outcome = await askOneLiveProbe({ model });
        results.push({ slug, model, ...outcome });
      }

      // record the verdict, so a reader can cite which id rotted
      console.log(
        [
          'fireworks catalog liveness',
          ...results.map(
            (result) =>
              `  ${result.served ? '✔' : '✘'} ${result.slug} -> ${result.model}`,
          ),
        ].join('\n'),
      );

      return {
        count: results.length,
        // .note = a RETIRED id may 404 by design: fireworks withdraws it on
        //         its own clock, and the caller then gets a named error that
        //         lists successors (`getOneRetirementError`). only an id with NO
        //         retirement on record is rot. measured 2026-09-26: four retired
        //         ids withdrawn, each already covered by its retirement row.
        dead: results
          .filter((result) => !result.served)
          .filter((result) => !isRetiredAtomSlug(result.slug))
          .map((result) => `${result.slug} (${result.model}): ${result.cause}`),
      };
    });

    when('[t0] the probe returns', () => {
      then('every id with no retirement on record serves', () => {
        expect(probed.dead).toEqual([]);
      });

      then('the catalog is not empty', () => {
        // .why = guards the guard: an empty catalog would pass the assertion
        //        above vacuously, so the rot detector would report green while
        //        it probed naught.
        expect(probed.count).toBeGreaterThan(0);
      });
    });
  });
});
