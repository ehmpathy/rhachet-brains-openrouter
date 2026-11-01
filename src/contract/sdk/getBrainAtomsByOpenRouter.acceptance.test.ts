import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { isIsoPrice, priceDivide, priceMultiply } from 'iso-price';
import { Completions } from 'openai/resources/chat/completions';
import { type BrainAtom, genContextBrain } from 'rhachet';
import type {
  BrainEffort,
  BrainPlugToolDefinition,
  BrainPlugToolExecution,
} from 'rhachet/brains';
import {
  type BrainAtomSlugOpenRouterBare,
  genBrainAtom,
  getBrainAtomsByOpenRouter,
} from 'rhachet-brains-openrouter';
import { getError, given, then, useBeforeAll, useThen, when } from 'test-fns';
import { z } from 'zod';

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { getOneTierModel } from '../../domain.operations/atom/getOneTierModel';
import { sdkOpenRouterEndpoints } from '../../domain.operations/supply/sdkOpenRouterEndpoints';

const REPO_ROOT = path.join(__dirname, '../../..');

/**
 * .what = a consumer's discovery path, as a plain node program
 * .why = rhachet scans package.json for `rhachet-brains-*` deps and loads each
 *        via a dynamic `import()`; jest's vm refuses that import, so the probe
 *        runs outside jest, as a consumer's process would
 *
 * .note = the last stdout line is one json object: the slug chosen and the answer
 */
const PROBE_DISCOVERY = `
const { genContextBrain } = require('rhachet');
const { z } = require('zod');
(async () => {
  const { brain } = await genContextBrain({
    choice: { atom: 'openrouter/deepseek/flash' },
    creds: async () => ({ OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY }),
  });
  const result = await brain.choice.ask({
    role: {},
    prompt: 'reply with exactly: hello via discovery',
    schema: { output: z.string() },
  });
  console.log(JSON.stringify({ slug: brain.choice.slug, output: String(result.output) }));
})().catch((error) => { console.error(error); process.exit(1); });
`;
const SCHEMA_PROBE_DISCOVERY = z.object({
  slug: z.string(),
  output: z.string(),
});

/**
 * .what = the openrouter api key, or a loud failure that names the fix
 * .why = every live case below spends real credit; an absent key must fail,
 *        never skip
 */
const getApiKey = (): string => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new ConstraintError('OPENROUTER_API_KEY required', {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
    });
  return apiKey;
};

/**
 * .what = the brain a consumer gets when they choose a slug by name
 * .why = the consumer's path, verbatim: register this package's atoms with
 *        rhachet, then name a `choice`. rhachet matches on `atom.slug`, exact —
 *        so this proves selection, never mere acceptance
 */
const getOneBrainChosen = (input: { choice: string }): BrainAtom =>
  genContextBrain({
    brains: { atoms: getBrainAtomsByOpenRouter() },
    choice: { atom: input.choice },
    creds: async () => ({ OPENROUTER_API_KEY: getApiKey() }),
  }).brain.choice;

/**
 * .what = a context that hands the api key to an atom built by `genBrainAtom`
 * .why = an unlisted id is not a listed brain, so it is asked directly
 */
const genContextOpenRouter = () => ({
  'brain.supplier.openrouter': {
    creds: async () => ({ OPENROUTER_API_KEY: getApiKey() }),
  },
});

/**
 * .what = GET an openrouter api path, as json — test setup only
 * .why = the unlisted id, and the jsonless id, are picked live from openrouter's catalog
 *
 * .note = each read names the shape it needs; a drifted body fails the test
 *         loud, rather than pass on a field read as `undefined`
 */
const getOneOpenRouterJson = async <TShape>(input: {
  path: string;
  schema: z.ZodType<TShape>;
}): Promise<TShape> => {
  const response = await fetch(`https://openrouter.ai/api/v1${input.path}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!response.ok)
    throw new MalfunctionError(`GET ${input.path} → ${response.status}`, {
      body: await response.text(),
    });
  return input.schema.parse(await response.json());
};

/**
 * .what = the `/models` fields the unlisted-id pick reads
 * .why = `pricing` and `architecture` are openrouter's own field names
 */
const SCHEMA_MODELS = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      architecture: z
        .object({
          input_modalities: z.array(z.string()).nullish(),
          output_modalities: z.array(z.string()).nullish(),
        })
        .nullish(),
      pricing: z
        .object({ prompt: z.union([z.string(), z.number()]) })
        .nullish(),
      supported_parameters: z.array(z.string()).nullish(),
    }),
  ),
});

/**
 * .what = asks a refused ask, and counts the completion sends it made
 * .why = credit is spent only by a completion send, so zero sends proves the
 *        key spent no credit. the key's `/key` usage cannot prove it: that is
 *        one meter for the whole key, and it drifts both ways while earlier
 *        charges settle (measured: 207.853540386 → 207.853557046 up across a
 *        refused typo; 207.895409165 → 207.886538656 down across a refused json
 *        ask, both after a settled read). the spy only observes; every call
 *        still goes to openrouter
 *
 * .note = openai@5 reads the global fetch when its client is built, and the
 *         atom builds its client inside `ask`, so the spy sees every send
 */
const getOneSendsOfRefusedAsk = async (input: {
  ask: () => Promise<unknown>;
}): Promise<{ error: Error; completionSends: number }> => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  try {
    const error = await getError(input.ask);
    const completionSends = fetchSpy.mock.calls.filter(([url]) =>
      String(url instanceof Request ? url.url : url).includes(
        '/chat/completions',
      ),
    ).length;
    return { error, completionSends };
  } finally {
    fetchSpy.mockRestore();
  }
};

/**
 * .what = a spy on the sdk's one chat completion call; it records, never replaces
 * .why = a thought cap or a sort must reach openrouter, not only the funnel, so a
 *        case reads the body the built package sent (F36)
 */
const spyCreate = jest.spyOn(Completions.prototype, 'create');
afterAll(() => spyCreate.mockRestore());

/**
 * .what = the five tier names this package lists, as literals
 * .why = a tier added or dropped without this suite goes red here
 */
const TIERS: BrainAtomSlugOpenRouterBare[] = [
  'openrouter/deepseek/pro',
  'openrouter/deepseek/flash',
  'openrouter/moonshotai/pro',
  'openrouter/z-ai/pro',
  'openrouter/z-ai/flash',
];

/**
 * .what = the `output.supply` fields a caller audits
 * .why = `supply` rides beside rhachet's declared output fields, so its type is
 *        absent from BrainOutput; this suite reads the built package from
 *        outside, so it checks the shape at runtime
 *
 * .note = strict: the charge lives in `metrics.cost.cash.total`, never here
 */
const SCHEMA_OUTPUT_SUPPLY = z.object({
  supply: z
    .object({
      provider: z.string(),
      generationId: z.string(),
      choice: z.object({
        sort: z.enum(['price', 'throughput', 'latency']).nullable(),
        funnel: z.array(z.object({ promise: z.string(), left: z.number() })),
        ranked: z.array(z.record(z.string(), z.unknown())),
      }),
      attempts: z.array(z.object({ outcome: z.string() })),
    })
    .strict(),
});

/**
 * .what = the supply report a caller audits, with each live value masked
 * .why = the host, the hops, and the endpoint rows move per call; the promise
 *        names come from the slug, so they stay and are reviewed
 */
const asStableSupply = (input: {
  supply: z.infer<typeof SCHEMA_OUTPUT_SUPPLY>['supply'];
}) => ({
  provider: '(live host)',
  generationId: '(live id)',
  attempts: `(live hops; last = ${input.supply.attempts.at(-1)?.outcome})`,
  choice: {
    sort: input.supply.choice.sort,
    // .note = the honors(json) step shows only when this machine's 7-day memory holds a
    //         host, so its presence is machine state; it is dropped from the snap
    funnel: input.supply.choice.funnel
      .filter((step) => !step.promise.startsWith('honors(json)'))
      .map((step) => ({
        promise: step.promise,
        left: '(live count)',
      })),
    ranked: `(live rows, keys: ${Object.keys(input.supply.choice.ranked[0] ?? {}).join(', ')})`,
  },
});

/**
 * .what = a zero-qualified refusal, with its live counts and rows masked
 * .why = the shape a human reads (headline, funnel promises, fix line) is
 *        computed from the slug; the counts and the endpoint table are live
 *
 * .note = the model id is live too, but each caller masks the EXACT id it
 *         expects, so a refusal that names any other model shows in the snap
 */
const asStableZeroQualified = (input: { message: string }): string => {
  const lines = input.message.split('\n');
  const metadataAt = lines.indexOf('{');
  const human = metadataAt === -1 ? lines : lines.slice(0, metadataAt);
  const masked = human.map((line) => {
    if (/^\s+\d+ ← /.test(line))
      return line.replace(/^\s+\d+ ← /, '    (live count) ← ');
    if (/^ {2}\$/.test(line)) return '  (a live endpoint row)';
    return line;
  });
  return masked
    .filter(
      (line, index) =>
        line !== '  (a live endpoint row)' || masked[index - 1] !== line,
    )
    .join('\n')
    .trimEnd();
};

/**
 * .what = a cheap text model openrouter lists today
 * .why = "any id serves" is proven on an id this package names nowhere — it
 *        keeps no model id at all; picked live, so the proof never goes stale
 *
 * .note = `pricing` is openrouter's own field name
 */
const getOneUnlistedIdLive = async (): Promise<string> => {
  const body = await getOneOpenRouterJson({
    path: '/models',
    schema: SCHEMA_MODELS,
  });
  // .note = a `~` id is an openrouter alias, with no endpoints of its own
  const candidates = body.data
    .filter((model) => !model.id.endsWith(':free'))
    .filter((model) => !model.id.startsWith('~'))
    .filter((model) => model.architecture?.input_modalities?.includes('text'))
    .filter((model) => model.architecture?.output_modalities?.includes('text'))
    .filter((model) => Number(model.pricing?.prompt) > 0)
    .sort((a, b) => Number(a.pricing?.prompt) - Number(b.pricing?.prompt));
  const found = candidates[0]?.id;
  if (!found)
    throw new MalfunctionError('no unlisted cheap text model in the catalog');
  return found;
};

/**
 * .what = a cheap text model openrouter lists today whose catalog row offers no
 *         `response_format`, so none of its endpoints can honor a json schema
 * .why = case=13 [t1] is proven on a model that cannot keep the json promise;
 *        picked live, so the proof never goes stale
 *
 * .note = measured 2026-10-02: 55 of 464 non-free ids lack `response_format`
 */
const getOneJsonlessIdLive = async (): Promise<string> => {
  const body = await getOneOpenRouterJson({
    path: '/models',
    schema: SCHEMA_MODELS,
  });
  const candidates = body.data
    .filter((model) => !model.id.endsWith(':free'))
    .filter((model) => model.architecture?.input_modalities?.includes('text'))
    .filter((model) => model.architecture?.output_modalities?.includes('text'))
    .filter(
      (model) =>
        !(model.supported_parameters ?? []).includes('response_format'),
    )
    .filter((model) => Number(model.pricing?.prompt) > 0)
    .sort((a, b) => Number(a.pricing?.prompt) - Number(b.pricing?.prompt));
  const found = candidates[0]?.id;
  if (!found)
    throw new MalfunctionError(
      'no text model in the catalog lacks response_format',
    );
  return found;
};

/**
 * .what = a cheap text model openrouter lists today whose catalog row offers no
 *         `reasoning`, so none of its endpoints can take a thought cap
 * .why = case=6 is proven on a model that cannot take an effort; picked live, so the
 *        proof never goes stale when a host adds reasoning
 */
const getOneReasonlessIdLive = async (): Promise<string> => {
  const body = await getOneOpenRouterJson({
    path: '/models',
    schema: SCHEMA_MODELS,
  });
  const candidates = body.data
    .filter((model) => !model.id.endsWith(':free'))
    .filter((model) => !model.id.startsWith('~'))
    .filter((model) => model.architecture?.input_modalities?.includes('text'))
    .filter((model) => model.architecture?.output_modalities?.includes('text'))
    .filter(
      (model) => !(model.supported_parameters ?? []).includes('reasoning'),
    )
    .filter((model) => Number(model.pricing?.prompt) > 0)
    .sort((a, b) => Number(a.pricing?.prompt) - Number(b.pricing?.prompt));
  const found = candidates[0]?.id;
  if (!found)
    throw new MalfunctionError('no text model in the catalog lacks reasoning');
  return found;
};

/**
 * .what = the part of a refusal a human reads, with live drift masked
 * .why = the snapshot must show the refusal's shape in review, yet the catalog
 *        moves: suggestions past the first (held by its own assertion) and the
 *        appended metadata json both change as openrouter ships models
 */
const asStableRefusal = (input: { message: string }): string => {
  const lines = input.message.split('\n');
  const metadataAt = lines.indexOf('{');
  const human = metadataAt === -1 ? lines : lines.slice(0, metadataAt);
  const suggestionFirst = human.findIndex((line) => line.startsWith('  - '));
  return human
    .map((line, index) =>
      line.startsWith('  - ') && index !== suggestionFirst
        ? '  - (a live suggestion)'
        : line,
    )
    .join('\n')
    .trimEnd();
};

/**
 * .what = a reply's token counts, each number masked, each null and each absent key kept
 * .why = the counts are live; whether a count is a number, null, or absent is the
 *        package's shape, and a caller reads it (`thought` included)
 */
const asStableTokens = (input: { tokens: unknown }): unknown => {
  if (typeof input.tokens === 'number') return '(live count)';
  if (input.tokens === null || typeof input.tokens !== 'object')
    return input.tokens;
  return Object.fromEntries(
    Object.entries(input.tokens).map(([key, value]) => [
      key,
      asStableTokens({ tokens: value }),
    ]),
  );
};

/**
 * .what = a refusal a human reads, whole, with its metadata json dropped
 * .why = the json repeats the headline for a machine; the snap shows what a human reads,
 *        as `asStableRefusal` and `asStableZeroQualified` do
 */
const asStableRefusalWhole = (input: { message: string }): string => {
  const lines = input.message.split('\n');
  const metadataAt = lines.indexOf('{');
  return (metadataAt === -1 ? lines : lines.slice(0, metadataAt))
    .join('\n')
    .trimEnd();
};

describe('getBrainAtomsByOpenRouter.acceptance', () => {
  // .why = a consumer never calls genBrainAtom; it registers the PUBLISHED
  //        atoms and names a choice. this suite goes through the built package
  //        and rhachet's own selection — the only surface a consumer touches
  given('[case1] every tier name, via the built package', () => {
    when('[t0] each is chosen by name via genContextBrain', () => {
      then('each resolves under the name chosen', () => {
        for (const slug of TIERS) {
          const brain = getOneBrainChosen({ choice: slug });
          expect(brain.slug).toEqual(slug);
        }
      });
    });
  });

  // .why = a consumer may name no brain list at all: rhachet scans package.json
  //        for `rhachet-brains-*` deps and calls each `getBrainAtomsBy*` export.
  //        this repo's self-link (`link:.`) is that dependency, so discovery here
  //        reaches the built package exactly as it would in a consumer's repo
  // .note = discovery runs in a plain node child, as a consumer runs it: rhachet
  //         loads each brain package via a dynamic `import()`, which jest's vm
  //         refuses without --experimental-vm-modules
  given('[case1b] a tier chosen by discovery, as the readme shows', () => {
    when('[t0] it is chosen with no brain list, and asked live', () => {
      const scene = useThen('it answers', async () => {
        const stdout = execFileSync('node', ['-e', PROBE_DISCOVERY], {
          cwd: REPO_ROOT,
          timeout: 120_000,
          env: { ...process.env, OPENROUTER_API_KEY: getApiKey() },
        }).toString('utf8');
        const lineLast = stdout.trim().split('\n').pop() ?? '';
        return SCHEMA_PROBE_DISCOVERY.parse(JSON.parse(lineLast));
      });

      then('rhachet found the brain under the name chosen', () => {
        expect(scene.slug).toEqual('openrouter/deepseek/flash');
      });

      then('the answer carries output', () => {
        expect(scene.output.toLowerCase()).toContain('hello');
      });
    });
  });

  // .why = the wish's own composite, as the reviewer fleet holds it (case=6, case=5)
  given('[case2] the preferred floor, chosen by name and asked live', () => {
    const choice =
      'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full';

    when('[t0] it is asked', () => {
      const result = useThen('it answers', async () =>
        getOneBrainChosen({ choice }).ask({
          role: {},
          prompt: 'reply with exactly: hello from the floor',
          schema: { output: z.string() },
        }),
      );

      // .why = an unset ask sends no new field: read the last body sent, on the built package
      const body = useThen(
        'the body it sent is read',
        async (): Promise<Record<string, unknown>> =>
          JSON.parse(JSON.stringify(spyCreate.mock.calls.at(-1)?.[0] ?? {})),
      );

      then(
        'the request body carries no reasoning and no sort, as 0.1.3',
        () => {
          expect(body).not.toHaveProperty('reasoning');
          expect(body).toHaveProperty('provider');
          expect(body.provider).not.toHaveProperty('sort');
        },
      );

      then('the answer carries output', () => {
        expect(String(result.output).toLowerCase()).toContain('hello');
      });

      then(
        'the token counts a caller reads, live values masked, match snapshot',
        () => {
          expect(
            asStableTokens({ tokens: result.metrics.size.tokens }),
          ).toMatchSnapshot();
        },
      );

      then('the supply names the provider that served, and the funnel', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(supply.provider).toBeTruthy();
        expect(supply.generationId).toBeTruthy();
        expect(supply.choice.funnel.length).toBeGreaterThan(1);
        expect(supply.attempts.at(-1)?.outcome).toEqual('served');
      });

      then('the charge lands in metrics, above zero', () => {
        expect(
          isIsoPrice.greater(result.metrics.cost.cash.total, 'USD 0.00'),
        ).toEqual(true);
      });

      then('the supply report a caller audits matches snapshot', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(asStableSupply({ supply })).toMatchSnapshot();
      });
    });
  });

  // .why = with no `floor`, the whole qualified set is admitted at once and a host
  //        fault hops to the rest (#21); `attempts` ends on `served` as on the floor
  // .note = a live run cannot force a host fault, so this snapshot masks the
  //         trail and reads like [case2]. the hop trail and the exhausted refusal
  //         a caller reads are pinned at unit grain: getOneAdmittedSetCompletion,
  //         getOneSuppliedCompletion, and getOneFloorExhaustedError snapshots
  given('[case2b] the same promises with no floor, asked live', () => {
    // .note = a composite with no floor is not a listed slug, so it is built by
    //         `genBrainAtom` from the published package, as case3 builds an id
    const slug = 'openrouter/deepseek/flash/speed=min50tps&privacy=full';

    when('[t0] it is asked', () => {
      const result = useThen('it answers', async () =>
        genBrainAtom({ slug }).ask(
          {
            role: {},
            prompt: 'reply with exactly: hello from the set',
            schema: { output: z.string() },
          },
          genContextOpenRouter(),
        ),
      );

      then('the answer carries output', () => {
        expect(String(result.output).toLowerCase()).toContain('hello');
      });

      then(
        'the supply ends on a serve; each hop before it was a host fault',
        () => {
          const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
          expect(supply.provider).toBeTruthy();
          expect(supply.attempts.at(-1)?.outcome).toEqual('served');
          supply.attempts
            .slice(0, -1)
            .forEach((attempt) =>
              expect(['throttled', 'refused', 'failed']).toContain(
                attempt.outcome,
              ),
            );
        },
      );

      then('the supply report a caller audits matches snapshot', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(asStableSupply({ supply })).toMatchSnapshot();
      });
    });
  });

  // .why = the reviewer floor's fastest-first twin, chosen by name, with a thought cap:
  //        the consumer's path for both levers this package adds (case=1, case=4)
  given(
    '[case2c] the preferred floor, fastest first, asked with a thought budget',
    () => {
      const choice =
        'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full&sort=throughput';

      when('[t0] it is asked with effort: { budget: { tokens: 600 } }', () => {
        const result = useThen('it answers', async () =>
          getOneBrainChosen({ choice }).ask({
            role: {},
            prompt: 'is 17 a prime number? reply with exactly yes or no',
            schema: { output: z.string() },
            effort: { budget: { tokens: 600 } },
          }),
        );

        // .why = the cap must reach openrouter, not only the funnel: read the last body sent
        const body = useThen(
          'the body it sent is read',
          async (): Promise<Record<string, unknown>> =>
            JSON.parse(JSON.stringify(spyCreate.mock.calls.at(-1)?.[0] ?? {})),
        );

        then('the request body carries the cap as openrouter expects', () => {
          expect(body.reasoning).toEqual({ max_tokens: 600 });
          expect(body.provider).toMatchObject({ sort: 'throughput' });
        });

        then('the answer carries output', () => {
          expect(String(result.output).toLowerCase()).toMatch(/yes|no/);
        });

        then(
          'the token counts a caller reads, live values masked, match snapshot',
          () => {
            expect(
              asStableTokens({ tokens: result.metrics.size.tokens }),
            ).toMatchSnapshot();
          },
        );

        then(
          'the supply names the sort the slug wrote, and a served hop',
          () => {
            const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
            expect(supply.choice.sort).toEqual('throughput');
            expect(supply.attempts.at(-1)?.outcome).toEqual('served');
          },
        );

        // .why = deepseek flash's hosts report reasoning tokens (q1, measured), so a null
        //        here is a dropped field, never a host that reports none
        then(
          'the thought spent is reported as a count within the output',
          () => {
            const thought = result.metrics.size.tokens.thought ?? null;
            expect(Number.isInteger(thought)).toEqual(true);
            expect(thought ?? -1).toBeGreaterThanOrEqual(0);
            expect(thought ?? Infinity).toBeLessThanOrEqual(
              result.metrics.size.tokens.output,
            );
          },
        );

        then('the funnel holds the reasoning and output-room promises', () => {
          const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
          const promises = supply.choice.funnel.map((step) => step.promise);
          expect(promises.some((p) => p.includes('reasoning'))).toEqual(true);
          expect(promises).toContain('thought<output.max (budget 600 tokens)');
        });

        then('the supply report a caller audits matches snapshot', () => {
          const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
          expect(asStableSupply({ supply })).toMatchSnapshot();
        });
      });
    },
  );

  // .why = the level form of the thought cap, on a bare tier, through the consumer's path (case=1)
  given('[case2d] a bare tier, asked with a thought level', () => {
    const choice = 'openrouter/deepseek/flash';

    when("[t0] it is asked with effort: 'low'", () => {
      const result = useThen('it answers', async () =>
        getOneBrainChosen({ choice }).ask({
          role: {},
          prompt: 'is 17 a prime number? reply with exactly yes or no',
          schema: { output: z.string() },
          effort: 'low',
        }),
      );

      // .why = the cap must reach openrouter, not only the funnel: read the last body sent
      const body = useThen(
        'the body it sent is read',
        async (): Promise<Record<string, unknown>> =>
          JSON.parse(JSON.stringify(spyCreate.mock.calls.at(-1)?.[0] ?? {})),
      );

      then('the request body carries the cap as openrouter expects', () => {
        expect(body.reasoning).toEqual({ effort: 'low' });
      });

      then('the answer carries output', () => {
        expect(String(result.output).toLowerCase()).toMatch(/yes|no/);
      });

      then(
        'the token counts a caller reads, live values masked, match snapshot',
        () => {
          expect(
            asStableTokens({ tokens: result.metrics.size.tokens }),
          ).toMatchSnapshot();
        },
      );

      then('the funnel holds the reasoning promise, and no budget step', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        const promises = supply.choice.funnel.map((step) => step.promise);
        expect(promises).toContain('supports(reasoning)');
        expect(
          promises.some((p) => p.startsWith('thought<output.max')),
        ).toEqual(false);
      });

      then('the thought spent is reported as a count within the output', () => {
        const thought = result.metrics.size.tokens.thought ?? null;
        expect(Number.isInteger(thought)).toEqual(true);
        expect(thought ?? -1).toBeGreaterThanOrEqual(0);
        expect(thought ?? Infinity).toBeLessThanOrEqual(
          result.metrics.size.tokens.output,
        );
      });

      then('the supply report a caller audits matches snapshot', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(asStableSupply({ supply })).toMatchSnapshot();
      });
    });
  });

  // 🔴 .why = the natural way to write "fast host" must keep every default promise, zero
  //           data retention included: a sort word orders hosts, never drops them
  given('[case2e] a bare tier with only a sort word, asked live', () => {
    when('[t0] it is asked', () => {
      const result = useThen('it answers', async () =>
        genBrainAtom({ slug: 'openrouter/deepseek/flash/sort=throughput' }).ask(
          {
            role: {},
            prompt: 'is 17 a prime number? reply with exactly yes or no',
            schema: { output: z.string() },
          },
          genContextOpenRouter(),
        ),
      );

      then('the answer carries output', () => {
        expect(String(result.output).toLowerCase()).toMatch(/yes|no/);
      });

      then('the funnel keeps the default promises, and names the sort', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        const promises = supply.choice.funnel.map((step) => step.promise);
        expect(promises).toContain('privacy=full (zdr list)');
        expect(promises).toContain('speed>=50tps');
        expect(supply.choice.sort).toEqual('throughput');
        expect(supply.attempts.at(-1)?.outcome).toEqual('served');
      });

      // .why = the order is the sort's whole promise, so it is checked live, not only by a unit clamp
      then('the qualified hosts rank fastest first', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        const tpsQualified = supply.choice.ranked
          .filter((row) => row.verdict === 'qualified')
          .map((row) => Number(row.tps ?? 0));
        expect(tpsQualified.length).toBeGreaterThan(0);
        expect(tpsQualified).toEqual([...tpsQualified].sort((a, b) => b - a));
      });

      then('the supply report a caller audits matches snapshot', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(asStableSupply({ supply })).toMatchSnapshot();
      });
    });
  });

  // .why = case=4 [t2]: with no floor, openrouter orders the admitted set by the sort itself
  // .note = a sort makes openrouter try hosts in order, so fallbacks stay on inside `only`:
  //         a throttled top host steps aside, and no hop leaves the admitted set (F31)
  given('[case2f] a sort with no floor, asked live', () => {
    when('[t0] it is asked', () => {
      const scene = useThen('it answers', async () => {
        spyCreate.mockClear(); // .note = clears the record of calls only; create stays real
        const result = await genBrainAtom({
          slug: 'openrouter/deepseek/flash/privacy=full&sort=throughput',
        }).ask(
          {
            role: {},
            prompt:
              'is 17 a prime number? reply as json: { "verdict": "yes" | "no" }',
            schema: { output: z.object({ verdict: z.string() }) },
          },
          genContextOpenRouter(),
        );
        const body: Record<string, unknown> = JSON.parse(
          JSON.stringify(spyCreate.mock.calls.at(-1)?.[0] ?? {}),
        ); // .note = the body as serialized onto the wire
        return { result, body, callsSent: spyCreate.mock.calls.length };
      });

      then('the answer carries output', () => {
        expect(['yes', 'no']).toContain(scene.result.output.verdict);
      });

      then(
        'one call admits the whole set, sorted by openrouter, fallbacks within it',
        () => {
          expect(scene.callsSent).toEqual(1);
          expect(scene.body.provider).toMatchObject({
            sort: 'throughput',
            allow_fallbacks: true,
            zdr: true, // the privacy promise rides every hop a fallback may take
          });
        },
      );

      then('the supply report a caller audits matches snapshot', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(scene.result);
        expect(supply.attempts.map((attempt) => attempt.outcome)).toEqual([
          'served',
        ]);
        expect(asStableSupply({ supply })).toMatchSnapshot();
      });
    });
  });

  // .why = "eliminate the need for constant updates": any openrouter id serves
  //        with no release of this package (case=20)
  given('[case3] an id this package has never heard of', () => {
    const scene = useBeforeAll(async () => ({
      id: await getOneUnlistedIdLive(),
    }));

    // .note = on the floor alone: the default supply filters (≥ 50 tps, full
    //         privacy) may leave a cheap long-tail model no endpoint
    when('[t0] it is asked, live, on the floor', () => {
      const result = useThen('it answers', async () =>
        genBrainAtom({ slug: `openrouter/${scene.id}/floor` }).ask(
          {
            role: {},
            prompt: 'reply with exactly: hello',
            schema: { output: z.string() },
          },
          genContextOpenRouter(),
        ),
      );

      then('the answer carries output', () => {
        expect(String(result.output).length).toBeGreaterThan(0);
      });

      then('the answer a caller reads matches snapshot', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect({
          output: typeof result.output,
          supply: asStableSupply({ supply }),
        }).toMatchSnapshot();
      });
    });
  });

  // .why = the control for the no-spend cases: a served ask must count its send,
  //        else a zero count there could mean the spy is blind
  given('[case3b] a served ask, through the send counter', () => {
    when('[t0] it is asked, live', () => {
      const scene = useThen('it is served', async () => {
        const fetchSpy = jest.spyOn(globalThis, 'fetch');
        try {
          await genBrainAtom({ slug: 'openrouter/deepseek/flash' }).ask(
            {
              role: {},
              prompt: 'reply with exactly: hello',
              schema: { output: z.string() },
            },
            genContextOpenRouter(),
          );
          return {
            completionSends: fetchSpy.mock.calls.filter(([url]) =>
              String(url instanceof Request ? url.url : url).includes(
                '/chat/completions',
              ),
            ).length,
          };
        } finally {
          fetchSpy.mockRestore();
        }
      });

      then('the counter sees at least one completion send', () => {
        expect(scene.completionSends).toBeGreaterThanOrEqual(1);
      });
    });
  });

  given('[case4] a typo of a real id', () => {
    when('[t0] it is asked, live', () => {
      const scene = useThen(
        'it is refused, and no completion is sent',
        async () => {
          const { error, completionSends } = await getOneSendsOfRefusedAsk({
            ask: () =>
              genBrainAtom({
                slug: 'openrouter/z-ai/glm-5.3-flahs/floor',
              }).ask(
                {
                  role: {},
                  prompt: 'reply with exactly: hello',
                  schema: { output: z.string() },
                },
                genContextOpenRouter(),
              ),
          });

          // .note = return plain data; an Error's `message` is non-enumerable
          //         and does not survive the useThen proxy
          return {
            isConstraint: error instanceof ConstraintError,
            message: error.message,
            completionSends,
          };
        },
      );

      then('the refusal is a ConstraintError', () => {
        expect(scene.isConstraint).toEqual(true);
      });

      then(
        'the intended id heads the suggestions, with the filter kept',
        () => {
          const suggestions = scene.message
            .split('\n')
            .filter((line) => line.startsWith('  - '));
          expect(suggestions[0]).toEqual(
            '  - openrouter/z-ai/glm-5.3-flash/floor',
          );
        },
      );

      then('no completion is sent, so the key spends no credit', () => {
        expect(scene.completionSends).toEqual(0);
      });

      then('the refusal a human reads matches snapshot', () => {
        expect(asStableRefusal({ message: scene.message })).toMatchSnapshot();
      });
    });
  });

  // .why = case=3: a filter word the grammar does not know is refused at parse
  given('[case5] a slug with an unknown filter word', () => {
    when('[t0] it is asked', () => {
      const scene = useThen('it is refused', async () => {
        const error = await getError(async () =>
          genBrainAtom({ slug: 'openrouter/deepseek/flash/floor&cheap' }).ask(
            {
              role: {},
              prompt: 'reply with exactly: hello',
              schema: { output: z.string() },
            },
            genContextOpenRouter(),
          ),
        );
        return {
          isConstraint: error instanceof ConstraintError,
          message: error.message,
        };
      });

      then('the refusal is a ConstraintError that names the word', () => {
        expect(scene.isConstraint).toEqual(true);
        expect(scene.message).toContain("'cheap': unknown word");
      });

      // .note = whole, metadata json included, as 0.1.3 pinned it
      then('the refusal a human reads matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // .why = case=4: promises no endpoint can keep are refused before any spend
  given('[case6] a price bound no endpoint meets', () => {
    when('[t0] it is asked, live', () => {
      const scene = useThen(
        'it is refused, and no completion is sent',
        async () => {
          const { error, completionSends } = await getOneSendsOfRefusedAsk({
            ask: () =>
              genBrainAtom({
                slug: 'openrouter/deepseek/flash/floor&price.max=0.0001usd/M',
              }).ask(
                {
                  role: {},
                  prompt: 'reply with exactly: hello',
                  schema: { output: z.string() },
                },
                genContextOpenRouter(),
              ),
          });
          // the same call the ask made: it reads this machine's held pick
          const modelPicked = await getOneTierModel(
            { tier: 'openrouter/deepseek/flash', apiKey: getApiKey() },
            { sdkOpenRouterEndpoints },
          );
          return {
            isConstraint: error instanceof ConstraintError,
            message: error.message,
            completionSends,
            modelPicked,
          };
        },
      );

      then('the refusal is a ConstraintError that names the fix', () => {
        expect(scene.isConstraint).toEqual(true);
        expect(scene.message).toContain('no call was sent');
        expect(scene.message).toContain('fix: drop or loosen the promise');
      });

      // .why = the id is live (a tier reaches its line's newest model), so it is
      //        read from the tier pick the ask itself made, then pinned exactly
      then('the refusal names the model the tier resolved to', () => {
        expect(scene.message).toContain(
          `no endpoint of ${scene.modelPicked} keeps every promise`,
        );
      });

      then('no completion is sent, so the key spends no credit', () => {
        expect(scene.completionSends).toEqual(0);
      });

      then('the refusal a human reads matches snapshot', () => {
        expect(
          asStableZeroQualified({
            message: scene.message
              .split(scene.modelPicked)
              .join('(a live model id)'),
          }),
        ).toMatchSnapshot();
      });
    });
  });

  // .why = case=12: an ask with no credential fails loud, with the fix
  given('[case7] a context with no openrouter credential', () => {
    when('[t0] the built atom is asked', () => {
      const scene = useThen('it is refused', async () => {
        const error = await getError(async () =>
          genBrainAtom({ slug: 'openrouter/deepseek/flash' }).ask(
            {
              role: {},
              prompt: 'reply with exactly: hello',
              schema: { output: z.string() },
            },
            {},
          ),
        );
        return {
          isConstraint: error instanceof ConstraintError,
          message: error.message,
        };
      });

      then('the refusal is a ConstraintError that names the fix', () => {
        expect(scene.isConstraint).toEqual(true);
        expect(scene.message).toContain("genContextBrainSupplier('openrouter'");
      });

      then('the refusal a human reads matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // .why = case=13: a json schema adds a promise; an endpoint that cannot honor
  //        it is skipped before the price rank. a text reply adds no promise
  given('[case8] the preferred floor, asked for json and for text', () => {
    const choice =
      'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full';

    when('[t0] it is asked with a json schema', () => {
      // .why = measured 2026-10-02: asked only "reply with: pong", a host
      //        answered `{"content":""}` — the shape held, the field was blank.
      //        the prompt names the field, so the word has one place to land
      const result = useThen('it answers', async () =>
        getOneBrainChosen({ choice }).ask({
          role: {},
          prompt:
            'reply as json. set the field "content" to the single word: pong',
          schema: { output: z.object({ content: z.string() }) },
        }),
      );

      then('the answer is the json shape asked for', () => {
        expect(
          z.object({ content: z.string() }).parse(result.output).content,
        ).toMatch(/pong/i);
      });

      then('the funnel names the json promise, and a host served', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(supply.choice.funnel.map((f) => f.promise)).toContain(
          'supports(response_format)',
        );
        expect(supply.choice.funnel.map((f) => f.promise)).toContain(
          'supports(structured_outputs)',
        );
        expect(supply.attempts.at(-1)?.outcome).toEqual('served');
      });

      // .why = the body reads in case2 and case2c–2f hold only if the spy sees the built
      //        package's calls; a served ask proves it does
      then('the completion spy recorded the call that served', () => {
        expect(spyCreate.mock.calls.length).toBeGreaterThan(0);
      });

      then('the supply report a caller audits matches snapshot', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(asStableSupply({ supply })).toMatchSnapshot();
      });
    });

    when('[t1] it is asked for text', () => {
      const result = useThen('it answers', async () =>
        getOneBrainChosen({ choice }).ask({
          role: {},
          prompt: 'reply with the single word: pong',
          schema: { output: z.string() },
        }),
      );

      then('the funnel holds no json promise', () => {
        const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
        expect(supply.choice.funnel.map((f) => f.promise)).not.toContain(
          'supports(response_format)',
        );
        expect(supply.choice.funnel.map((f) => f.promise)).not.toContain(
          'supports(structured_outputs)',
        );
      });
    });
  });

  // .why = case=13 [t1]: a model none of whose endpoints can honor a json schema
  //        is refused before any spend, with the promise that emptied the funnel
  given('[case9] a model that cannot honor a json schema', () => {
    const model = useBeforeAll(async () => ({
      id: await getOneJsonlessIdLive(),
    }));

    when('[t0] it is asked on the floor with a json schema, live', () => {
      const scene = useThen(
        'it is refused, and no completion is sent',
        async () => {
          const { error, completionSends } = await getOneSendsOfRefusedAsk({
            ask: () =>
              genBrainAtom({ slug: `openrouter/${model.id}/floor` }).ask(
                {
                  role: {},
                  prompt: 'reply with the single word: pong',
                  schema: { output: z.object({ content: z.string() }) },
                },
                genContextOpenRouter(),
              ),
          });
          return {
            isConstraint: error instanceof ConstraintError,
            message: error.message,
            completionSends,
          };
        },
      );

      then(
        'the refusal is a ConstraintError that names the json promise',
        () => {
          expect(scene.isConstraint).toEqual(true);
          expect(scene.message).toContain('no call was sent');
          expect(scene.message).toContain('supports(response_format)');
          expect(scene.message).toContain('supports(structured_outputs)');
        },
      );

      then('no completion is sent, so the key spends no credit', () => {
        expect(scene.completionSends).toEqual(0);
      });

      then('the refusal a human reads matches snapshot', () => {
        expect(
          asStableZeroQualified({
            message: scene.message.split(model.id).join('(a live model id)'),
          }),
        ).toMatchSnapshot();
      });
    });
  });

  // .why = case=19: a slug of the wrong shape is refused, and names both forms
  //        that would work
  given('[case10] a slug that is neither listed nor an openrouter id', () => {
    when('[t0] it is asked', () => {
      const scene = useThen('it is refused', async () => {
        const error = await getError(async () =>
          genBrainAtom({ slug: 'openrouter/acme' }).ask(
            {
              role: {},
              prompt: 'reply with exactly: hello',
              schema: { output: z.string() },
            },
            genContextOpenRouter(),
          ),
        );
        return {
          isConstraint: error instanceof ConstraintError,
          message: error.message,
        };
      });

      then('the refusal names a tier and the any-id form', () => {
        expect(scene.isConstraint).toEqual(true);
        expect(scene.message).toContain('a tier');
        expect(scene.message).toContain('any openrouter id');
      });

      // .note = whole, metadata json included, as 0.1.3 pinned it
      then('the refusal a human reads matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // .why = case=29: a key openrouter rejects (401) is named, with the fix
  given('[case11] a key openrouter does not recognize', () => {
    when('[t0] the built atom is asked, live', () => {
      const scene = useThen('it is refused', async () => {
        const error = await getError(async () =>
          genBrainAtom({ slug: 'openrouter/deepseek/flash' }).ask(
            {
              role: {},
              prompt: 'reply with exactly: hello',
              schema: { output: z.string() },
            },
            {
              'brain.supplier.openrouter': {
                creds: async () => ({
                  OPENROUTER_API_KEY: 'sk-or-v1-not-a-real-key-for-acceptance',
                }),
              },
            },
          ),
        );
        return {
          isConstraint: error instanceof ConstraintError,
          message: error.message,
        };
      });

      then('the refusal is a ConstraintError that names the key page', () => {
        expect(scene.isConstraint).toEqual(true);
        expect(scene.message).toContain('please check the key');
        expect(scene.message).toContain('/settings/keys');
      });

      then('the refusal a human reads matches snapshot', () => {
        expect(asStableRefusal({ message: scene.message })).toMatchSnapshot();
      });
    });
  });

  // .why = case=28: a caller's tool loop that hands back an error execution with
  //        no error in its output is named before any call is sent
  given('[case12] a tool execution that breaks its own contract', () => {
    const TOOL_WAVE_REPORT: BrainPlugToolDefinition = {
      slug: 'getWaveReport',
      name: 'Wave Report',
      description: 'get the wave report for a surf spot',
      schema: {
        input: z.object({ spot: z.string() }),
        output: z.object({ heightFt: z.number() }),
      },
    };

    when('[t0] it is handed back to the built atom', () => {
      const scene = useThen('it is refused', async () => {
        // .note = a json round trip builds the runtime shape a broken tool loop
        //         hands back, with no cast
        const executions: BrainPlugToolExecution[] = JSON.parse(
          JSON.stringify([
            {
              exid: 'call-1',
              slug: 'getWaveReport',
              input: { spot: 'mavericks' },
              signal: 'error:constraint',
              output: { reason: 'closed for the season' },
              metrics: { cost: { time: { milliseconds: 3 } } },
            },
          ]),
        );
        const error = await getError(async () =>
          genBrainAtom({ slug: 'openrouter/deepseek/flash' }).ask(
            {
              role: {},
              prompt: executions,
              schema: { output: z.string() },
              plugs: { tools: [TOOL_WAVE_REPORT] },
            },
            genContextOpenRouter(),
          ),
        );
        return {
          isConstraint: error instanceof ConstraintError,
          message: error.message,
        };
      });

      then('the refusal is a ConstraintError that names the execution', () => {
        expect(scene.isConstraint).toEqual(true);
        expect(scene.message).toContain("tool execution 'call-1'");
      });

      then('the refusal a human reads matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // .why = case=23: a price bound is proven by the bill. the charge must sit at
  //        or under every billed token at the bound — input and output alike.
  //        an ad-hoc filter slug is not a registered name, so it is reached
  //        through the built package's genBrainAtom, as case3 does
  given(
    '[case13] a price bound a host meets, asked live via the built package',
    () => {
      const slug = 'openrouter/deepseek/flash/floor&price.max=1usd/M';

      when('[t0] it is asked', () => {
        const result = useThen('it answers', async () =>
          genBrainAtom({ slug }).ask(
            {
              role: {},
              prompt: 'reply with exactly: hello under the bound',
              schema: { output: z.string() },
            },
            genContextOpenRouter(),
          ),
        );

        then('the supply names the price promise, and a host served', () => {
          const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
          expect(supply.choice.funnel.map((step) => step.promise)).toContain(
            'price.max=1usd/M',
          );
          expect(supply.attempts.at(-1)?.outcome).toEqual('served');
        });

        then(
          'the charge is at or under every billed token at the bound',
          () => {
            const tokens = result.metrics.size.tokens;
            const tokensBilled =
              tokens.input +
              tokens.output +
              tokens.cache.get +
              tokens.cache.set;
            const bound = priceDivide({
              of: priceMultiply({ of: 'USD 1.00', by: tokensBilled }),
              by: 1_000_000,
            });
            expect(
              isIsoPrice.greater(result.metrics.cost.cash.total, bound),
            ).toEqual(false);
          },
        );

        then('the supply report a caller audits matches snapshot', () => {
          const { supply } = SCHEMA_OUTPUT_SUPPLY.parse(result);
          expect(asStableSupply({ supply })).toMatchSnapshot();
        });
      });
    },
  );

  // .why = case=7: a malformed thought cap or host sort is refused through the contract,
  //        before any spend — the same shapes the unit suites snap, here via the built package
  const REFUSALS_CASE7: {
    description: string;
    getSlug: () => Promise<Parameters<typeof genBrainAtom>[0]['slug']>; // a refusal on a live-picked model reads the catalog first
    effort: BrainEffort | null;
    expectInMessage: string;
    isZeroQualified: boolean; // a funnel refusal lists live hosts and counts, which drift; they are masked
  }[] = [
    {
      description: 'an effort level this brain does not list',
      getSlug: async () => 'openrouter/deepseek/flash',
      // .note = the untyped caller rhachet's union forbids; refusal tests cast it
      effort: 'extreme' as unknown as BrainEffort,
      expectInMessage: 'invalid effort',
      isZeroQualified: false,
    },
    {
      description: 'an effort with both a level and a budget',
      getSlug: async () => 'openrouter/deepseek/flash',
      // .note = the untyped caller rhachet's union forbids; refusal tests cast it
      effort: {
        level: 'low',
        budget: { tokens: 1000 },
      } as unknown as BrainEffort,
      expectInMessage: 'both level and budget',
      isZeroQualified: false,
    },
    {
      description: 'a latency sort under floor',
      getSlug: async () => 'openrouter/deepseek/flash/floor&sort=latency',
      effort: null,
      expectInMessage: 'sort=latency',
      isZeroQualified: false,
    },
    {
      description: 'a sort word openrouter does not know',
      getSlug: async () => 'openrouter/deepseek/flash/sort=fastest',
      effort: null,
      expectInMessage: 'fastest',
      isZeroQualified: false,
    },
    {
      // .why = q6: a budget past every host's output limit leaves no room to answer
      description: 'a thought budget past every host output limit',
      getSlug: async () => 'openrouter/deepseek/flash',
      effort: { budget: { tokens: 10_000_000 } },
      expectInMessage: '0 ← thought<output.max (budget 10,000,000 tokens)',
      isZeroQualified: true,
    },
    {
      // .why = case=6: a model no host of which lists reasoning, picked live so it never goes stale
      description: 'an effort on a model whose hosts list no reasoning',
      getSlug: async () => `openrouter/${await getOneReasonlessIdLive()}`,
      effort: 'low',
      expectInMessage: '0 ← supports(reasoning)',
      isZeroQualified: true,
    },
    {
      // .why = a sort word alone merges onto the default, which holds floor, so a latency
      //        sort is refused as the written-out slug would be
      description: 'a latency sort alone, under the default floor',
      getSlug: async () => 'openrouter/deepseek/flash/sort=latency',
      effort: null,
      expectInMessage: 'cannot order by latency',
      isZeroQualified: false,
    },
    {
      // .why = case=7 [t0]: the budget a caller most often gets wrong is a count that is no count
      description: 'a thought budget of zero tokens',
      getSlug: async () => 'openrouter/deepseek/flash',
      effort: { budget: { tokens: 0 } },
      expectInMessage: 'tokens must be a positive integer',
      isZeroQualified: false,
    },
  ];
  REFUSALS_CASE7.map((refusal, index) =>
    given(`[case${14 + index}] ${refusal.description}`, () => {
      when('[t0] it is asked', () => {
        const scene = useThen(
          'it is refused, and no completion is sent',
          async () => {
            const slug = await refusal.getSlug();
            const { error, completionSends } = await getOneSendsOfRefusedAsk({
              ask: () =>
                genBrainAtom({ slug }).ask(
                  {
                    role: {},
                    prompt: 'reply with exactly: hello',
                    schema: { output: z.string() },
                    ...(refusal.effort !== null
                      ? { effort: refusal.effort }
                      : {}),
                  },
                  genContextOpenRouter(),
                ),
            });
            return {
              isConstraint: error instanceof ConstraintError,
              message: error.message,
              completionSends,
            };
          },
        );

        then('the refusal is a ConstraintError that names the cause', () => {
          expect(scene.isConstraint).toEqual(true);
          expect(scene.message).toContain(refusal.expectInMessage);
        });

        then('no completion is sent, so the key spends no credit', () => {
          expect(scene.completionSends).toEqual(0);
        });

        then('the refusal a human reads matches snapshot', () => {
          expect(
            refusal.isZeroQualified
              ? asStableZeroQualified({
                  message: scene.message
                    .replace(
                      /no endpoint of \S+/,
                      'no endpoint of (a live model id)',
                    )
                    .replace(
                      /below [\d,]+, the largest/,
                      'below (live limit), the largest',
                    ), // a host's limit is live catalog data
                })
              : asStableRefusalWhole({ message: scene.message }),
          ).toMatchSnapshot();
        });
      });
    }),
  );
});
