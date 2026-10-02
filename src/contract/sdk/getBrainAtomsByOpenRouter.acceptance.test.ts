import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { isIsoPrice, priceDivide, priceMultiply } from 'iso-price';
import { type BrainAtom, genContextBrain } from 'rhachet';
import type {
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
 * .why = the unlisted id is picked live, and the key's usage is read before
 *        and after a refusal
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
 * .what = the `/key` field the no-spend check reads
 * .why = the key's lifetime usage, in usd
 */
const SCHEMA_KEY = z.object({ data: z.object({ usage: z.number() }) });

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
    funnel: input.supply.choice.funnel.map((step) => ({
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
  // .note = skipped by the wisher's call: rhachet loads each brain package via a
  //         dynamic `import()`, which jest's vm refuses without
  //         --experimental-vm-modules, so discovery degrades to no brains here.
  //         the fix is caught in
  //         .dream/v2026_10_02.fix.acceptance-discovery-under-jest-vm.md
  given.skip('[case1b] a tier chosen by discovery, as the readme shows', () => {
    when('[t0] it is chosen with no brain list, and asked live', () => {
      const scene = useThen('it answers', async () => {
        const { brain } = await genContextBrain({
          choice: { atom: 'openrouter/deepseek/flash' },
          creds: async () => ({ OPENROUTER_API_KEY: getApiKey() }),
        });
        const result = await brain.choice.ask({
          role: {},
          prompt: 'reply with exactly: hello via discovery',
          schema: { output: z.string() },
        });
        return { slug: brain.choice.slug, output: String(result.output) };
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

      then('the answer carries output', () => {
        expect(String(result.output).toLowerCase()).toContain('hello');
      });

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

  given('[case4] a typo of a real id', () => {
    when('[t0] it is asked, live', () => {
      const scene = useThen(
        'it is refused, and the key spends no credit',
        async () => {
          const usageBefore = (
            await getOneOpenRouterJson({ path: '/key', schema: SCHEMA_KEY })
          ).data.usage;
          const error = await getError(
            genBrainAtom({ slug: 'openrouter/z-ai/glm-5.3-flahs/floor' }).ask(
              {
                role: {},
                prompt: 'reply with exactly: hello',
                schema: { output: z.string() },
              },
              genContextOpenRouter(),
            ),
          );
          const usageAfter = (
            await getOneOpenRouterJson({ path: '/key', schema: SCHEMA_KEY })
          ).data.usage;

          // .note = return plain data; an Error's `message` is non-enumerable
          //         and does not survive the useThen proxy
          return {
            isConstraint: error instanceof ConstraintError,
            message: error.message,
            usageBefore,
            usageAfter,
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

      then('the key usage did not move', () => {
        expect(scene.usageAfter).toEqual(scene.usageBefore);
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

      then('the refusal a human reads matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  // .why = case=4: promises no endpoint can keep are refused before any spend
  given('[case6] a price bound no endpoint meets', () => {
    when('[t0] it is asked, live', () => {
      const scene = useThen(
        'it is refused, and the key spends no credit',
        async () => {
          const usageBefore = (
            await getOneOpenRouterJson({ path: '/key', schema: SCHEMA_KEY })
          ).data.usage;
          const error = await getError(async () =>
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
          );
          const usageAfter = (
            await getOneOpenRouterJson({ path: '/key', schema: SCHEMA_KEY })
          ).data.usage;
          return {
            isConstraint: error instanceof ConstraintError,
            message: error.message,
            usageBefore,
            usageAfter,
          };
        },
      );

      then('the refusal is a ConstraintError that names the fix', () => {
        expect(scene.isConstraint).toEqual(true);
        expect(scene.message).toContain('no call was sent');
        expect(scene.message).toContain('fix: drop or loosen the promise');
      });

      then('the key usage did not move', () => {
        expect(scene.usageAfter).toEqual(scene.usageBefore);
      });

      then('the refusal a human reads matches snapshot', () => {
        expect(
          asStableZeroQualified({ message: scene.message }),
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
          'supports(response_format,structured_outputs)',
        );
        expect(supply.attempts.at(-1)?.outcome).toEqual('served');
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
          'supports(response_format,structured_outputs)',
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
        'it is refused, and the key spends no credit',
        async () => {
          const usageBefore = (
            await getOneOpenRouterJson({ path: '/key', schema: SCHEMA_KEY })
          ).data.usage;
          const error = await getError(async () =>
            genBrainAtom({ slug: `openrouter/${model.id}/floor` }).ask(
              {
                role: {},
                prompt: 'reply with the single word: pong',
                schema: { output: z.object({ content: z.string() }) },
              },
              genContextOpenRouter(),
            ),
          );
          const usageAfter = (
            await getOneOpenRouterJson({ path: '/key', schema: SCHEMA_KEY })
          ).data.usage;
          return {
            isConstraint: error instanceof ConstraintError,
            message: error.message,
            usageBefore,
            usageAfter,
          };
        },
      );

      then(
        'the refusal is a ConstraintError that names the json promise',
        () => {
          expect(scene.isConstraint).toEqual(true);
          expect(scene.message).toContain('no call was sent');
          expect(scene.message).toContain(
            'supports(response_format,structured_outputs)',
          );
        },
      );

      then('the key usage did not move', () => {
        expect(scene.usageAfter).toEqual(scene.usageBefore);
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
});
