import { ConstraintError, UnexpectedCodePathError } from 'helpful-errors';
import path from 'path';
import { genContextBrainSupplier } from 'rhachet';
import type {
  BrainEpisode,
  BrainPlugToolDefinition,
  BrainPlugToolExecution,
  BrainPlugToolInvocation,
} from 'rhachet/brains';
import { genArtifactGitFile } from 'rhachet-artifact-git';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { TEST_ASSETS_DIR } from '../../.test/assets/dir';
import type { BrainSuppliesOpenRouter } from './BrainAtom.config';
import { genBrainAtom } from './genBrainAtom';
import type { BrainAtomSlugOpenRouter } from './slug/AtomSlug';
import { getAllAtomSlugs } from './slug/getAllAtomSlugs';

const BRIEFS_DIR = path.join(TEST_ASSETS_DIR, '/example.briefs');

const outputSchema = z.object({ content: z.string() });

// tool use requires z.string() schema (vllm cannot do structured output + tool calls together)
const toolOutputSchema = z.string();

// keyrack context for all tests
const context = genContextBrainSupplier<'openrouter', BrainSuppliesOpenRouter>(
  'openrouter',
  { creds: { keyrack: { owner: 'ehmpath', env: 'test' } } },
);

describe('genBrainAtom.integration', () => {
  jest.setTimeout(90000);

  // the bare deepseek flash tier: cheap and fast, so the bulk of the suite rides it
  const brainAtom = genBrainAtom({ slug: 'openrouter/deepseek/flash' });

  // the glm flash tier for tool use tests (reliable tool call + slug support)
  const brainAtomWithTools = genBrainAtom({ slug: 'openrouter/z-ai/flash' });

  given('[case1] genBrainAtom({ slug: "openrouter/deepseek/flash" })', () => {
    when('[t0] atom is created', () => {
      then('repo is "openrouter"', () => {
        expect(brainAtom.repo).toEqual('openrouter');
      });

      // 🔴 .why = the atom keeps the name it was asked by, so a consumer who
      //           holds the tier name can select it
      //           (`rule.require.versionless-slugs-selectable`)
      then('slug is the tier name it was asked by', () => {
        expect(brainAtom.slug).toEqual('openrouter/deepseek/flash');
      });

      then('description names the line it reads, never a version', () => {
        expect(brainAtom.description).toContain(
          'openrouter/deepseek/flash -> newest',
        );
      });

      then('description is defined', () => {
        expect(brainAtom.description).toBeDefined();
        expect(brainAtom.description.length).toBeGreaterThan(0);
      });
    });
  });

  given('[case2] ask is called', () => {
    when('[t0] with simple prompt', () => {
      // call the operation once and share result across assertions
      const result = useThen('it returns a response', async () =>
        brainAtom.ask(
          {
            role: {},
            prompt: 'respond with exactly: hello world',
            schema: { output: outputSchema },
          },
          context,
        ),
      );

      then('response contains "hello"', () => {
        expect(result.output.content).toBeDefined();
        expect(result.output.content.length).toBeGreaterThan(0);
        expect(result.output.content.toLowerCase()).toContain('hello');
      });

      then('metrics includes token counts', () => {
        expect(result.metrics.size.tokens.input).toBeGreaterThan(0);
        expect(result.metrics.size.tokens.output).toBeGreaterThan(0);
      });

      then('metrics includes cash costs', () => {
        expect(result.metrics.cost.cash.deets.input).toBeDefined();
        expect(result.metrics.cost.cash.deets.output).toBeDefined();
        expect(result.metrics.cost.cash.total).toBeDefined();
      });

      then('metrics includes time cost', () => {
        expect(result.metrics.cost.time).toBeDefined();
      });
    });

    when('[t1] with briefs', () => {
      then('response leverages knowledge from brief', async () => {
        const briefs = [
          genArtifactGitFile({
            uri: path.join(BRIEFS_DIR, 'secret-code.brief.md'),
          }),
        ];
        const result = await brainAtom.ask(
          {
            role: { briefs },
            prompt: 'say hello',
            schema: { output: outputSchema },
          },
          context,
        );
        expect(result.output.content).toBeDefined();
        expect(result.output.content).toContain('ZEBRA42');
      });
    });
  });

  given('[case3] episode continuation', () => {
    when('[t0] ask is called with initial prompt', () => {
      const resultFirst = useThen('it succeeds', async () =>
        brainAtom.ask(
          {
            role: {},
            prompt:
              'remember this secret code: MANGO77. respond with "code received"',
            schema: { output: outputSchema },
          },
          context,
        ),
      );

      then('it returns an episode', () => {
        expect(resultFirst.episode).toBeDefined();
        expect(resultFirst.episode.hash).toBeDefined();
        expect(resultFirst.episode.exchanges).toHaveLength(1);
      });

      then('series is null for atoms', () => {
        expect(resultFirst.series).toBeNull();
      });
    });

    when('[t1] ask is called with continuation via on.episode', () => {
      const resultFirst = useThen('first ask succeeds', async () =>
        brainAtom.ask(
          {
            role: {},
            prompt:
              'remember this secret code: PAPAYA99. respond with "code stored"',
            schema: { output: outputSchema },
          },
          context,
        ),
      );

      const resultSecond = useThen('second ask succeeds', async () =>
        brainAtom.ask(
          {
            on: { episode: resultFirst.episode },
            role: {},
            prompt: 'what was the secret code i told you to remember?',
            schema: { output: outputSchema },
          },
          context,
        ),
      );

      then('continuation remembers context from prior exchange', () => {
        expect(resultSecond.output.content).toContain('PAPAYA99');
      });

      then('episode accumulates exchanges', () => {
        expect(resultSecond.episode.exchanges).toHaveLength(2);
      });
    });
  });

  given('[case4] all models leverage briefs', () => {
    // every tier, each on the model it reads from the catalog today
    const allSlugs: BrainAtomSlugOpenRouter[] = getAllAtomSlugs();

    const briefs = [
      genArtifactGitFile({
        uri: path.join(BRIEFS_DIR, 'secret-code.brief.md'),
      }),
    ];

    for (const slug of allSlugs) {
      when(`[${slug}] ask is called with briefs`, () => {
        // .note = prompt is neutral ('acknowledge this message'), not 'say hello' — a
        //         literal 'say hello' competed with the brief's directive, and several
        //         open-weight models intermittently followed the surface prompt and
        //         dropped the brief.
        //         attempts raised 3->5 as a secondary margin; llm inference stays
        //         probabilistic even with the prompt no longer in tension with the brief.
        then.repeatably({
          attempts: 5,
          criteria: 'SOME',
        })('response contains ZEBRA42', async () => {
          const atom = genBrainAtom({ slug });
          const result = await atom.ask(
            {
              role: { briefs },
              prompt: 'acknowledge this message',
              schema: { output: outputSchema },
            },
            context,
          );
          expect(result.output.content).toContain('ZEBRA42');
        });
      });
    }
  });

  // tool definition for tool use tests
  const weatherTool: BrainPlugToolDefinition = {
    slug: 'weather.lookup',
    name: 'Weather Lookup',
    description: 'get current weather for a city',
    schema: {
      input: z.object({ city: z.string() }),
      output: z.object({ temp: z.number(), conditions: z.string() }),
    },
  };

  given('[case5] tool invocation', () => {
    when('[t0] tools plugged, prompt requires tool use', () => {
      const result = useThen('it returns tool calls', async () =>
        brainAtomWithTools.ask(
          {
            role: {},
            prompt: 'what is the current weather in austin, texas?',
            schema: { output: toolOutputSchema },
            plugs: { tools: [weatherTool] },
          },
          context,
        ),
      );

      then('result.calls.tools contains invocations', () => {
        expect(result.calls).toBeDefined();
        expect(result.calls?.tools).toBeDefined();
        expect(result.calls?.tools?.length).toBeGreaterThan(0);
      });

      then('result.output is null', () => {
        expect(result.output).toBeNull();
      });

      then('each invocation has exid, slug, input', () => {
        const invocation = result.calls?.tools?.[0];
        expect(invocation?.exid).toBeDefined();
        expect(invocation?.slug).toEqual('weather.lookup');
        expect(invocation?.input).toBeDefined();
      });

      then('invocation.input is typed per tool schema', () => {
        const invocation = result.calls?.tools?.[0];
        expect(invocation?.input).toHaveProperty('city');
        const input = invocation?.input as { city: string };
        expect(typeof input.city).toEqual('string');
      });

      then('the calls shape a caller reads matches snapshot', () => {
        // .note = the id and the model's words are live; the shape is not
        const shape = (result.calls?.tools ?? []).map((invocation) => ({
          exid: typeof invocation.exid === 'string' ? '(live id)' : null,
          slug: invocation.slug,
          inputKeys: Object.keys(invocation.input ?? {}).sort(),
        }));
        expect(shape.slice(0, 1)).toMatchSnapshot();
      });
    });

    // .note = "tools plugged, brain answers directly" is not covered: with tools
    //         present, response_format is withheld (vllm-based hosts reject
    //         both at once), so a direct answer would not conform to a schema
  });

  given('[case6] tool continuation', () => {
    when('[t0] ask returns tool calls, then continue with executions', () => {
      const resultFirst = useThen('first ask returns tool calls', async () =>
        brainAtomWithTools.ask(
          {
            role: {},
            prompt: 'what is the weather in new york city?',
            schema: { output: toolOutputSchema },
            plugs: { tools: [weatherTool] },
          },
          context,
        ),
      );

      const resultSecond = useThen(
        'second ask with tool executions succeeds',
        async () => {
          const invocation = resultFirst.calls?.tools?.[0];
          if (!invocation)
            throw new UnexpectedCodePathError('no tool invocation found', {
              resultFirst,
            });

          const executions: BrainPlugToolExecution[] = [
            {
              exid: invocation.exid,
              slug: invocation.slug,
              input: invocation.input,
              signal: 'success',
              output: { temp: 45, conditions: 'cloudy' },
              metrics: { cost: { time: { milliseconds: 100 } } },
            },
          ];

          return brainAtomWithTools.ask(
            {
              on: { episode: resultFirst.episode },
              role: {},
              prompt: executions,
              schema: { output: toolOutputSchema },
              plugs: { tools: [weatherTool] },
            },
            context,
          );
        },
      );

      then('brain synthesizes final answer from tool results', () => {
        expect(resultSecond.output).toBeDefined();
        expect(resultSecond.output).not.toBeNull();
        expect(typeof resultSecond.output).toEqual('string');
      });

      then('episode.exchanges accumulates tool exchange', () => {
        expect(resultSecond.episode.exchanges.length).toBeGreaterThan(1);
      });

      then('result.calls is null after final answer', () => {
        expect(resultSecond.calls).toBeNull();
      });
    });
  });

  given('[case7] error signals in tool execution', () => {
    /**
     * .what = answers each tool call with the same error signal until the brain
     *         replies in text, up to a bound
     * .why = after a tool error a model may retry the tool (measured 2026-10-02:
     *        glm-5.3-flash retries 'city not found' every time) — a valid,
     *        graceful move. the caller's loop answers it again, as a real
     *        tool loop would, and the brain must then give up in prose
     */
    const askUntilAnswered = async (input: {
      episode: BrainEpisode;
      invocations: BrainPlugToolInvocation[];
      signal: BrainPlugToolExecution['signal'];
      error: Error;
      roundsLeft: number;
    }): Promise<{ output: string | null }> => {
      // answer every call with the error, then ask again
      const executions: BrainPlugToolExecution[] = input.invocations.map(
        (invocation) => ({
          exid: invocation.exid,
          slug: invocation.slug,
          input: invocation.input,
          signal: input.signal,
          output: { error: input.error },
          metrics: { cost: { time: { milliseconds: 50 } } },
        }),
      );
      const result = await brainAtomWithTools.ask(
        {
          on: { episode: input.episode },
          role: {},
          prompt: executions,
          schema: { output: toolOutputSchema },
          plugs: { tools: [weatherTool] },
        },
        context,
      );

      // the brain replied in prose, or the bound is spent
      const invocations: BrainPlugToolInvocation[] = result.calls?.tools ?? [];
      if (invocations.length === 0 || input.roundsLeft <= 1)
        return { output: result.output };

      // the brain retried the tool: answer it again
      return askUntilAnswered({
        ...input,
        episode: result.episode,
        invocations,
        roundsLeft: input.roundsLeft - 1,
      });
    };

    // .note = strict: each run must end in prose after the error. the caller's
    //         loop answers a retried tool call, so a retry is no failure
    when('[t0] signal is error:constraint', () => {
      then('brain receives error context and responds', async () => {
        // first get tool call
        const resultFirst = await brainAtomWithTools.ask(
          {
            role: {},
            prompt: 'what is the weather in tokyo?',
            schema: { output: toolOutputSchema },
            plugs: { tools: [weatherTool] },
          },
          context,
        );

        const invocations = resultFirst.calls?.tools ?? [];
        if (invocations.length === 0)
          throw new UnexpectedCodePathError('no tool invocation found', {
            resultFirst,
          });

        // continue with error:constraint signal, until the brain answers
        const resultFinal = await askUntilAnswered({
          episode: resultFirst.episode,
          invocations,
          signal: 'error:constraint',
          error: new Error('city not found in database'),
          roundsLeft: 3,
        });

        // brain should give up in prose, never loop forever
        expect(resultFinal.output).toBeDefined();
        expect(resultFinal.output).not.toBeNull();
      });
    });

    when('[t1] signal is error:malfunction', () => {
      then('brain handles system failure gracefully', async () => {
        // first get tool call
        const resultFirst = await brainAtomWithTools.ask(
          {
            role: {},
            prompt: 'what is the weather in london?',
            schema: { output: toolOutputSchema },
            plugs: { tools: [weatherTool] },
          },
          context,
        );

        const invocations = resultFirst.calls?.tools ?? [];
        if (invocations.length === 0)
          throw new UnexpectedCodePathError('no tool invocation found', {
            resultFirst,
          });

        // continue with error:malfunction signal, until the brain answers
        const resultFinal = await askUntilAnswered({
          episode: resultFirst.episode,
          invocations,
          signal: 'error:malfunction',
          error: new Error('weather service unavailable'),
          roundsLeft: 3,
        });

        // brain should give up in prose, never loop forever
        expect(resultFinal.output).toBeDefined();
        expect(resultFinal.output).not.toBeNull();
      });
    });
  });

  // .note = case8 "structured output with tools on initial invocation" is not
  //         covered: response_format is withheld when tools are plugged.
  //         structured output works on tool continuation

  given('[case9] tool use model compatibility', () => {
    // every tier declares tooluse; each is exercised here
    const toolCompatSlugs: BrainAtomSlugOpenRouter[] = getAllAtomSlugs();

    for (const slug of toolCompatSlugs) {
      when(`[${slug}] ask is called with tools`, () => {
        then.repeatably({
          attempts: 3,
          criteria: 'SOME',
        })('tool invocation works', async () => {
          const atom = genBrainAtom({ slug });
          const result = await atom.ask(
            {
              role: {},
              prompt: 'what is the current weather in seattle?',
              schema: { output: toolOutputSchema },
              plugs: { tools: [weatherTool] },
            },
            context,
          );
          // model should invoke the weather tool
          // note: some models (kimi) strip the namespace from tool names
          expect(result.calls).toBeDefined();
          expect(result.calls?.tools?.length).toBeGreaterThan(0);
          const toolSlug = result.calls?.tools?.[0]?.slug ?? '';
          expect(toolSlug === 'weather.lookup' || toolSlug === 'lookup').toBe(
            true,
          );
        });
      });
    }
  });

  given('[case12] an unlisted openrouter id (case=20)', () => {
    // .why = any openrouter id serves with no release of this package; a typo
    //        is refused before any spend, with the ids it likely meant
    when('[t0] a typo of a real id is asked', () => {
      const error = useThen('it is refused', async () => {
        const errorCaught = await getError(
          genBrainAtom({ slug: 'openrouter/z-ai/glm-5.3-flahs/floor' }).ask(
            {
              role: {},
              prompt: 'respond with exactly: hello world',
              schema: { output: outputSchema },
            },
            context,
          ),
        );

        // .note = return plain data; an Error's `message` is non-enumerable
        //         and does not survive the useThen proxy
        return {
          isConstraint: errorCaught instanceof ConstraintError,
          message: errorCaught.message,
        };
      });

      then('the refusal is a ConstraintError that names the absent id', () => {
        expect(error.isConstraint).toEqual(true);
        expect(error.message).toContain(
          "openrouter lists no model 'z-ai/glm-5.3-flahs'",
        );
      });

      then(
        'the intended id heads the suggestions, as a ready slug with the filter kept',
        () => {
          const suggestions = error.message
            .split('\n')
            .filter((line) => line.startsWith('  - '));
          expect(suggestions[0]).toEqual(
            '  - openrouter/z-ai/glm-5.3-flash/floor',
          );
          expect(suggestions).toHaveLength(5);
        },
      );
    });
  });

  given('[case10] error paths', () => {
    when('[t0] tools plugged with non-string schema', () => {
      then('throws ConstraintError with helpful message', async () => {
        const error = await getError(() =>
          brainAtomWithTools.ask(
            {
              role: {},
              prompt: 'hello',
              schema: { output: z.object({ value: z.number() }) },
              plugs: { tools: [weatherTool] },
            },
            context,
          ),
        );
        expect(error.message).toContain('when tools are plugged');
        expect(error.message).toContain('z.string()');
        expect(error.message).toMatchSnapshot();
      });
    });

    when('[t1] no credentials in context', () => {
      then('throws ConstraintError that names the fix', async () => {
        const error = await getError(() =>
          brainAtomWithTools.ask(
            { role: {}, prompt: 'hello', schema: { output: z.string() } },
            {},
          ),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain("genContextBrainSupplier('openrouter'");
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given('[case11] tool use on open-source models', () => {
    const calculatorTool: BrainPlugToolDefinition = {
      slug: 'calculator.multiply',
      name: 'Calculator Multiply',
      description: 'Multiplies two numbers together',
      schema: {
        input: z.object({
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        }),
        output: z.object({ result: z.number() }),
      },
    };

    // test tool use on models that support it
    const modelsToTest: BrainAtomSlugOpenRouter[] = [
      'openrouter/z-ai/flash',
      'openrouter/deepseek/flash',
    ];

    for (const slug of modelsToTest) {
      when(`[${slug}] tool invocation and continuation`, () => {
        then.repeatably({
          attempts: 3,
          criteria: 'SOME',
        })('tool call + continuation works', async () => {
          const atom = genBrainAtom({ slug });

          // first call: brain should request tool
          const resultFirst = await atom.ask(
            {
              role: {},
              prompt:
                'Call the calculator tool to multiply 6 times 9. You must call the tool.',
              plugs: { tools: [calculatorTool] },
              schema: { output: toolOutputSchema },
            },
            context,
          );

          // verify tool call is returned
          expect(resultFirst.output).toBeNull();
          expect(resultFirst.calls?.tools).toBeDefined();
          expect(resultFirst.calls?.tools?.length).toBeGreaterThan(0);
          expect(resultFirst.calls?.tools?.[0]?.slug).toEqual(
            'calculator.multiply',
          );

          // second call: feed tool result, expect text output
          const toolCall = resultFirst.calls?.tools?.[0];
          if (!toolCall)
            throw new UnexpectedCodePathError('no tool call in first result', {
              resultFirst,
            });

          const resultSecond = await atom.ask(
            {
              on: { episode: resultFirst.episode },
              role: {},
              prompt: [
                {
                  exid: toolCall.exid,
                  slug: toolCall.slug,
                  input: toolCall.input,
                  signal: 'success' as const,
                  output: { result: 54 },
                  metrics: { cost: { time: { milliseconds: 1 } } },
                },
              ],
              plugs: { tools: [calculatorTool] },
              schema: { output: toolOutputSchema },
            },
            context,
          );

          // verify output is valid string with result
          expect(resultSecond.output).not.toBeNull();
          expect(typeof resultSecond.output).toEqual('string');
          expect(resultSecond.output).toContain('54');
        });
      });
    }
  });
});
