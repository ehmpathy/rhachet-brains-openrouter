import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { Completions } from 'openai/resources/chat/completions';
import { genContextBrainSupplier } from 'rhachet';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import type { SupplyReport } from '../../domain.objects/SupplyReport';
import { isThoughtCapIgnored } from '../supply/isThoughtCapIgnored';
import type { BrainSuppliesOpenRouter } from './BrainAtom.config';
import { genBrainAtom } from './genBrainAtom';

const context = genContextBrainSupplier<'openrouter', BrainSuppliesOpenRouter>(
  'openrouter',
  { creds: { keyrack: { owner: 'ehmpath', env: 'test' } } },
);

const outputSchema = z.object({ verdict: z.string() });
const prompt =
  'is 17 a prime number? think it through, then reply as json: { "verdict": "yes" | "no" }';

const SLUG_FLOOR =
  'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full' as const;

/**
 * .what = a spy on the real sdk's create, so each live call's request body is read
 * .why = the atom builds its own openai client; a spy (never a mock) sees the body
 *        that went to openrouter, while the call itself stays real
 */
const spyCreate = jest.spyOn(Completions.prototype, 'create');

/**
 * .what = runs one live ask and returns its result plus the body of its last hop
 * .why = the wish owes proof that each option reaches the body, and that an unset
 *        option sends no key at all
 */
const askAndReadBody = async (input: {
  slug: Parameters<typeof genBrainAtom>[0]['slug'];
  effort?: Parameters<ReturnType<typeof genBrainAtom>['ask']>[0]['effort'];
}) => {
  spyCreate.mockClear(); // .note = clears the record of calls only; create stays real
  const result = await genBrainAtom({ slug: input.slug }).ask(
    {
      role: {},
      prompt,
      schema: { output: outputSchema },
      ...(input.effort ? { effort: input.effort } : {}),
    },
    context,
  );
  const body: Record<string, unknown> = JSON.parse(
    JSON.stringify(spyCreate.mock.calls.at(-1)?.[0] ?? {}),
  ); // .note = the body as serialized onto the wire: the exact keys openrouter receives
  const supply = (result as unknown as { supply: SupplyReport }).supply; // .note = supply rides beside rhachet's declared fields. removal: when rhachet's BrainOutput declares `supply`
  return { result, body, supply };
};

/**
 * .what = the live thought cap and host sort: each reaches openrouter's body as
 *         openrouter expects, an unset one sends no key, and a host honors both
 * .why = only a live call proves a host honors a budget (q1) and openrouter takes the body
 */
describe('genBrainAtom.effort-and-sort.integration', () => {
  jest.setTimeout(120000);
  afterAll(() => spyCreate.mockRestore());

  given('[case1] a thought budget on the reviewer floor', () => {
    when('[t0] asked with effort: { budget: { tokens: 600 } }', () => {
      const asked = useThen('it answers', async () =>
        askAndReadBody({
          slug: SLUG_FLOOR,
          effort: { budget: { tokens: 600 } },
        }),
      );

      then('the body carries reasoning.max_tokens, never effort', () => {
        expect(asked.body.reasoning).toEqual({ max_tokens: 600 });
      });

      then('the answer parses, so the budget left room for it', () => {
        expect(['yes', 'no']).toContain(asked.result.output.verdict);
      });

      then('the thought is reported as a count or null, never NaN', () => {
        const thought = asked.result.metrics.size.tokens.thought ?? null;
        expect(
          thought === null ||
            (Number.isInteger(thought) &&
              thought >= 0 &&
              thought <= asked.result.metrics.size.tokens.output),
        ).toEqual(true);
      });
    });
  });

  given('[case2] an effort level on the reviewer floor', () => {
    when("[t0] asked with effort: 'low'", () => {
      const asked = useThen('it answers', async () =>
        askAndReadBody({ slug: SLUG_FLOOR, effort: 'low' }),
      );

      then('the body carries reasoning.effort, never max_tokens', () => {
        expect(asked.body.reasoning).toEqual({ effort: 'low' });
      });

      then('the answer parses', () => {
        expect(['yes', 'no']).toContain(asked.result.output.verdict);
      });
    });
  });

  given('[case3] neither option set, as 0.1.3', () => {
    when('[t0] asked on the plain reviewer floor', () => {
      const asked = useThen('it answers', async () =>
        askAndReadBody({ slug: SLUG_FLOOR }),
      );

      then('the body holds no reasoning key', () => {
        expect('reasoning' in asked.body).toEqual(false);
      });

      then('the provider preference holds no sort key', () => {
        expect('sort' in (asked.body.provider as object)).toEqual(false);
      });

      then('the report names no sort', () => {
        expect(asked.supply.choice?.sort).toEqual(null);
      });
    });
  });

  given('[case4] the floor slug with sort=throughput', () => {
    when('[t0] asked', () => {
      const asked = useThen('it answers', async () =>
        askAndReadBody({ slug: `${SLUG_FLOOR}&sort=throughput` }),
      );

      then(
        'the provider preference holds sort: throughput, fallbacks off',
        () => {
          expect(asked.body.provider).toMatchObject({
            sort: 'throughput',
            allow_fallbacks: false,
          });
        },
      );

      then('the report names the sort', () => {
        expect(asked.supply.choice?.sort).toEqual('throughput');
      });

      then('the answer parses', () => {
        expect(['yes', 'no']).toContain(asked.result.output.verdict);
      });
    });
  });

  // .why = q1: a listed param is not an honored one. a thought-heavy prompt under a
  //        small budget shows what each host does with the cap it was sent
  // .note = a host's honor is a draw, not a property, so it is logged, never asserted.
  //         measured 2026-10-21, budgets 300 · 600 · 1200 · 2400: Relace (deepseek flash)
  //         thought 179–489, then past 600 under 400 on a later draw; OpenInference (z-ai
  //         flash) thought 875–1218 whatever the cap, then under 400 on a later draw.
  //         what the package owes is asserted: the budget reaches the host, the thought is
  //         reported, and an overrun is named (`isThoughtCapIgnored`, unit-tested)
  given(
    '[case6] a small thought budget on a thought-heavy prompt, per tier',
    () => {
      const BUDGET = 400;
      const TIERS = [
        'openrouter/deepseek/flash',
        'openrouter/z-ai/flash',
        'openrouter/moonshotai/pro',
      ] as const;
      TIERS.map((slug, index) =>
        when(
          `[t${index}] ${slug} is asked with effort: { budget: { tokens: ${BUDGET} } }`,
          () => {
            const asked = useThen(
              'it settles: an answer, or a named all-thought error',
              async () => {
                spyCreate.mockClear();
                const settled = await genBrainAtom({ slug })
                  .ask(
                    {
                      role: {},
                      prompt:
                        'how many prime numbers are there below 300? check each candidate step by step, then reply as json: { "verdict": "<the count>" }',
                      schema: { output: outputSchema },
                      effort: { budget: { tokens: BUDGET } },
                    },
                    context,
                  )
                  .then(
                    (result) => ({
                      tokensThought: result.metrics.size.tokens.thought ?? null,
                      provider: (result as unknown as { supply: SupplyReport })
                        .supply.provider, // .note = supply rides beside rhachet's declared fields
                      defect: null,
                    }),
                    (error: unknown) => {
                      if (!(error instanceof MalfunctionError)) throw error;
                      const { tokensThought, defect, provider } =
                        error.metadata ?? {};
                      return {
                        tokensThought:
                          typeof tokensThought === 'number'
                            ? tokensThought
                            : null,
                        provider:
                          typeof provider === 'string' ? provider : null,
                        defect: typeof defect === 'string' ? defect : null,
                      };
                    },
                  );
                const body: Record<string, unknown> = JSON.parse(
                  JSON.stringify(spyCreate.mock.calls.at(-1)?.[0] ?? {}),
                ); // .note = the body as serialized onto the wire
                // log the draw, so a host's honor stays measurable run to run
                const draw = {
                  slug,
                  provider: settled.provider,
                  budget: BUDGET,
                  tokensThought: settled.tokensThought,
                  ignored: isThoughtCapIgnored({
                    tokensThought: settled.tokensThought,
                    tokensThoughtBudget: BUDGET,
                  }),
                };
                console.log('thought cap draw', draw);
                return { ...settled, body, draw };
              },
            );

            then('the budget reached the host as reasoning.max_tokens', () => {
              expect(asked.body.reasoning).toEqual({ max_tokens: BUDGET });
            });

            then('the host reports its thought', () => {
              expect(asked.tokensThought).not.toEqual(null);
            });

            then('a reply defect, if any, is all-thought by name', () => {
              expect([null, 'all-thought']).toContain(asked.defect);
            });

            // .why = the draw's values are a host's choice, so they are masked; its shape
            //        is the package's, so it is snapped (F35)
            then(
              'the logged draw, live values masked, matches snapshot',
              () => {
                expect(typeof asked.draw.ignored).toEqual('boolean');
                expect({
                  ...asked.draw,
                  provider: '(live host)',
                  tokensThought: '(live count)',
                  ignored: '(live draw)',
                }).toMatchSnapshot();
              },
            );
          },
        ),
      );
    },
  );

  // .why = case=4 [t2]: with no floor, openrouter orders the admitted set by the sort itself
  given('[case7] a sort with no floor', () => {
    when('[t0] asked on privacy=full&sort=throughput', () => {
      const asked = useThen('it answers', async () =>
        askAndReadBody({
          slug: 'openrouter/deepseek/flash/privacy=full&sort=throughput',
        }),
      );

      // .why = a sort tries hosts in order; fallbacks inside `only` let a throttled top
      //        host step aside, and `only` still bounds every hop (F31)
      then(
        'the provider preference holds sort: throughput, fallbacks within the set',
        () => {
          expect(asked.body.provider).toMatchObject({
            sort: 'throughput',
            allow_fallbacks: true,
          });
        },
      );

      then('more than one host is admitted, for openrouter to order', () => {
        const only = (asked.body.provider as { only?: string[] }).only ?? [];
        expect(only.length).toBeGreaterThan(1);
      });

      then('the answer parses', () => {
        expect(['yes', 'no']).toContain(asked.result.output.verdict);
      });
    });
  });

  given('[case5] an invalid effort', () => {
    when('[t0] asked with effort: { budget: { tokens: 0 } }', () => {
      then('it refuses before any call, with the valid shapes', async () => {
        spyCreate.mockClear();
        const error = await getError(
          askAndReadBody({
            slug: SLUG_FLOOR,
            effort: { budget: { tokens: 0 } },
          }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('valid shapes, one of:');
        expect(spyCreate).not.toHaveBeenCalled();
      });
    });
  });
});
