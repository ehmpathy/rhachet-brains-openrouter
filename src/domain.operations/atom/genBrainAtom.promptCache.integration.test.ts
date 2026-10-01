import { BadRequestError } from 'helpful-errors';
import OpenAI from 'openai';
import { genContextBrainSupplier } from 'rhachet';
import { genArtifactGitFile } from 'rhachet-artifact-git';
import { genTempDir, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  type BrainSuppliesFireworks,
  CONFIG_BY_ATOM_SLUG,
} from './BrainAtom.config';
import { genBrainAtom } from './genBrainAtom';

if (!process.env.FIREWORKS_API_KEY)
  throw new BadRequestError(
    'FIREWORKS_API_KEY is required for integration tests',
    {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
      env: 'FIREWORKS_API_KEY',
    },
  );

// .note = a LIVE pin, never a retired one. the control arm calls the raw model
//         id, which skips the retirement route — so a withdrawn id 404s here
//         (measured 2026-09-26: `deepseek-v4-flash-0731` withdrawn).
const SLUG = 'fireworks/deepseek/flash/v4.1' as const;
const MODEL = CONFIG_BY_ATOM_SLUG[SLUG].model;

/**
 * .what = how many asks each arm makes
 * .why = one pair proves naught — a single call can hit by luck of replica
 *        assignment. a rate over N calls is the claim worth the make.
 */
const ARM_CALLS = 6;

const outputSchema = z.object({ content: z.string() });

const context = genContextBrainSupplier<'fireworks', BrainSuppliesFireworks>(
  'fireworks',
  { creds: { keyrack: { owner: 'ehmpath', env: 'test' } } },
);

const openai = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: 'https://api.fireworks.ai/inference/v1',
});

/**
 * .what = composes a long, byte-stable system prompt, unique to one arm
 * .why = two demands meet here:
 *        1. LONG — a provider caches a prefix in blocks, so a short prompt has
 *           no block to reuse and reports zero cached tokens however the
 *           request is routed.
 *        2. ARM-UNIQUE AT THE HEAD — the nonce leads, so the control arm and
 *           the treatment arm diverge at token 0 and can never share a cached
 *           prefix. that isolation is what makes the two rates comparable.
 */
const asArmSystemPrompt = (input: { nonce: string }): string =>
  [
    `# surf school operations manual (edition ${input.nonce})`,
    ...Array.from(
      { length: 240 },
      (_unused, index) =>
        `${index + 1}. lesson policy ${index + 1}: a surfer books a lesson at one spot, with one board, for one instructor. the instructor confirms the tide window before the lesson is held, and records the wave report that justified the call.`,
    ),
  ].join('\n');

/**
 * .what = tallies cache hits across the follow-up calls of one arm
 * .why = the first call of an arm cannot hit — it is what fills the cache.
 *        so the rate is measured over calls 2..N.
 */
const asArmHitRate = (input: {
  usages: { tokensPrompt: number; tokensCached: number }[];
}): { hits: number; calls: number; rate: number; tokensCached: number } => {
  const followups = input.usages.slice(1);
  const hits = followups.filter((usage) => usage.tokensCached > 0).length;
  return {
    hits,
    calls: followups.length,
    rate: followups.length ? hits / followups.length : 0,
    tokensCached: followups.reduce((sum, u) => sum + u.tokensCached, 0),
  };
};

describe('genBrainAtom.promptCache.integration', () => {
  // .note = 2 arms x 6 sequential real calls. observed single-call latency for
  //         fireworks/deepseek/flash/v4 ranges 1-28s, so 12 in sequence needs
  //         real headroom.
  jest.setTimeout(600000);

  given('[case1] a role whose briefs repeat across calls', () => {
    // each arm gets its own run-unique prefix, so neither can warm the other
    const nonceTreatment = randomUUID();
    const nonceControl = randomUUID();

    const measured = useThen('both arms complete their calls', async () => {
      // ── treatment arm: through genBrainAtom, which pins replica affinity ──
      const briefDir = genTempDir();
      const briefPath = path.join(briefDir, 'long.brief.md');
      writeFileSync(
        briefPath,
        asArmSystemPrompt({ nonce: nonceTreatment }),
        'utf8',
      );
      const briefs = [genArtifactGitFile({ uri: briefPath })];
      const atom = genBrainAtom({ slug: SLUG });

      const treatment: {
        tokensPrompt: number;
        tokensCached: number;
        tokensInput: number;
      }[] = [];
      for (let i = 0; i < ARM_CALLS; i += 1) {
        const result = await atom.ask(
          {
            role: { briefs },
            // the prompt varies per call; only the briefs repeat. that is
            // precisely the shape the affinity key is built to serve.
            prompt: `reply with one short sentence about lesson policy ${i + 1}`,
            schema: { output: outputSchema },
          },
          context,
        );
        treatment.push({
          tokensPrompt:
            result.metrics.size.tokens.input +
            result.metrics.size.tokens.cache.get,
          tokensCached: result.metrics.size.tokens.cache.get,
          tokensInput: result.metrics.size.tokens.input,
        });
      }

      // ── control arm: same composition, no affinity header ──
      const systemControl = asArmSystemPrompt({ nonce: nonceControl });
      const control: { tokensPrompt: number; tokensCached: number }[] = [];
      for (let i = 0; i < ARM_CALLS; i += 1) {
        const response = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: systemControl },
            {
              role: 'user',
              content: `reply with one short sentence about lesson policy ${i + 1}`,
            },
          ],
        });
        const usage = response.usage as
          | {
              prompt_tokens?: number;
              prompt_tokens_details?: { cached_tokens?: number };
            }
          | undefined;
        control.push({
          tokensPrompt: usage?.prompt_tokens ?? 0,
          tokensCached: usage?.prompt_tokens_details?.cached_tokens ?? 0,
        });
      }

      const rates = {
        treatment: asArmHitRate({ usages: treatment }),
        control: asArmHitRate({ usages: control }),
      };

      // record the measurement, so a reader can cite the numbers
      console.log(
        [
          'prompt-cache hit rate',
          `  model     = ${MODEL}`,
          `  calls/arm = ${ARM_CALLS} (rate measured over the ${ARM_CALLS - 1} follow-ups)`,
          `  control   = ${rates.control.hits}/${rates.control.calls} hit (${(rates.control.rate * 100).toFixed(0)}%), ${rates.control.tokensCached} cached tokens`,
          `  treatment = ${rates.treatment.hits}/${rates.treatment.calls} hit (${(rates.treatment.rate * 100).toFixed(0)}%), ${rates.treatment.tokensCached} cached tokens`,
        ].join('\n'),
      );

      return { treatment, control, rates };
    });

    when('[t0] the asks are pinned to one replica by affinity', () => {
      then('the follow-up calls report cached tokens', () => {
        expect(measured.rates.treatment.tokensCached).toBeGreaterThan(0);
        expect(measured.rates.treatment.hits).toBeGreaterThan(0);
      });

      then('most follow-up calls hit the cache', () => {
        expect(measured.rates.treatment.rate).toBeGreaterThanOrEqual(0.5);
      });

      then('the pinned arm hits at least as often as the unpinned one', () => {
        // .note = non-strict on purpose. serverless traffic placement is a
        //         hint, so an unpinned arm can hit by luck; a strict `>` would
        //         make a true fix look broken on a lucky run. the absolute
        //         floor above is the claim; this guards the direction.
        expect(measured.rates.treatment.hits).toBeGreaterThanOrEqual(
          measured.rates.control.hits,
        );
      });
    });

    when('[t1] a cached call is priced', () => {
      then('input excludes the cached tokens, so each is billed once', () => {
        // .why = fireworks reports `prompt_tokens` as the TOTAL prompt with
        //        `cached_tokens` a subset. rhachet sums input + cache.get as
        //        disjoint addends, so input must carry only the uncached part.
        const hit = measured.treatment.find((call) => call.tokensCached > 0);
        expect(hit).toBeDefined();
        expect(hit?.tokensInput).toEqual(
          (hit?.tokensPrompt ?? 0) - (hit?.tokensCached ?? 0),
        );
        expect(hit?.tokensInput).toBeLessThan(hit?.tokensPrompt ?? 0);
      });
    });
  });

  given('[case2] a role with no briefs', () => {
    when('[t0] ask is called', () => {
      then('the call still succeeds, unpinned', async () => {
        // .why = with no briefs there is no prefix to share, so no affinity key
        //        is sent. the request must still work.
        const atom = genBrainAtom({ slug: SLUG });
        const result = await atom.ask(
          {
            role: {},
            prompt: 'respond with exactly: hello world',
            schema: { output: outputSchema },
          },
          context,
        );
        expect(result.output.content.toLowerCase()).toContain('hello');
      });
    });
  });
});
