import { BadRequestError } from 'helpful-errors';
import OpenAI from 'openai';
import type { ContextBrainSupplier } from 'rhachet';
import {
  BrainAtom,
  type BrainEpisode,
  BrainOutput,
  BrainOutputMetrics,
  type BrainPlugs,
  type BrainPlugToolExecution,
  type BrainPlugToolInvocation,
  calcBrainOutputCost,
  castBriefsToPrompt,
  genBrainContinuables,
  getSdkCredsFromBrainSupplies,
} from 'rhachet/brains';
import type { Artifact } from 'rhachet-artifact';
import type { GitFile } from 'rhachet-artifact-git';
import { z } from 'zod';

import { asBrainSizeTokens } from '../../infra/cast/asBrainSizeTokens';
import { castContentToOutputSchema } from '../../infra/cast/castContentToOutputSchema';
import { castFromFireworksToolCall } from '../../infra/cast/castFromFireworksToolCall';
import { castIntoFireworksToolDef } from '../../infra/cast/castIntoFireworksToolDef';
import { castIntoFireworksToolMessages } from '../../infra/cast/castIntoFireworksToolMessages';
import {
  type BrainSuppliesFireworks,
  CONFIG_BY_ATOM_SLUG,
} from './BrainAtom.config';
import { getOnePromptCacheAffinityKey } from './getOnePromptCacheAffinityKey';
import type { BrainAtomSlugFireworks } from './slug/AtomSlug';
import { asPinnedAtomSlug } from './slug/asPinnedAtomSlug';
import { getOneRetirementError } from './slug/getOneRetirementError';

// re-export for consumers
export type { BrainSuppliesFireworks } from './BrainAtom.config';
export type { BrainAtomSlugFireworks } from './slug/AtomSlug';

/**
 * .what = typed context for fireworks brain supplier
 * .why = enables type-safe credential injection via genContextBrainSupplier('fireworks', ...)
 */
export type ContextBrainSupplierFireworks = ContextBrainSupplier<
  'fireworks',
  BrainSuppliesFireworks
>;

/**
 * .what = factory to generate fireworks ai brain atom instances
 * .why = enables model variant selection via slug
 *
 * .note = fireworks ai api is openai-compatible with baseURL override
 *
 * .note = the slug a caller names is RESOLVED before lookup, so a retired slug
 *         and a versionless generic both reach a live model with no edit on
 *         the caller's side (`asPinnedAtomSlug`).
 *
 * .example
 *   genBrainAtom({ slug: 'fireworks/deepseek/flash' })        // bare versionless, never churns
 *   genBrainAtom({ slug: 'fireworks/deepseek/flash/latest' }) // versionless, never churns
 *   genBrainAtom({ slug: 'fireworks/deepseek/flash/v4.1' })   // pinned, byte-stable
 *   genBrainAtom({ slug: 'fireworks/deepseek/flash/v4' })     // retired -> routed to v4.1-flash
 *   genBrainAtom({ slug: 'fireworks/deepseek/v4-flash' })     // legacy -> flash/v4 -> routed to v4.1-flash
 *
 * .note = every atom carries the name it was built from as `atom.slug`, so a
 *         consumer who selects by that name finds it, and reaches the pin.
 */
export const genBrainAtom = (input: {
  slug: BrainAtomSlugFireworks;
}): BrainAtom<ContextBrainSupplierFireworks> => {
  // resolve the named slug onto the pinned slug that serves it
  const slug = asPinnedAtomSlug({ slug: input.slug });

  // guard for invalid slug (runtime protection for js callers)
  const config = CONFIG_BY_ATOM_SLUG[slug];
  const validSlugs = Object.keys(CONFIG_BY_ATOM_SLUG);
  if (!config)
    throw new BadRequestError(
      `invalid fireworks brain atom slug: '${input.slug}'. valid slugs: ${validSlugs.join(', ')}`,
      { slug: input.slug, valid: validSlugs },
    );

  return new BrainAtom({
    repo: 'fireworks',
    // 🔴 .note = the atom keeps the EXACT name it was built from — pinned,
    //         versionless, legacy, or retired-and-routed alike. a registry
    //         selects by `atom.slug`, so a renamed atom is one no consumer can
    //         choose by the name they hold (`rule.require.redirected-slugs-selectable`).
    //         the description names the pin it reaches, so no log hides the weights.
    slug: input.slug,
    description:
      input.slug === slug
        ? config.description
        : `${config.description} (${input.slug} -> ${slug})`,
    spec: config.spec,

    /**
     * .what = stateless inference with optional tool use
     * .why = provides direct model access for tasks
     *
     * .note = outputs are non-deterministic (llm inference)
     * .note = supports continuation via `on.episode`
     * .note = supports tool use via `plugs.tools`
     */
    ask: async <TOutput, TPlugs extends BrainPlugs = BrainPlugs>(
      askInput: {
        on?: { episode: BrainEpisode };
        plugs?: TPlugs;
        role: { briefs?: Artifact<typeof GitFile>[] };
        prompt: string | BrainPlugToolExecution[];
        schema: { output: z.Schema<TOutput> };
      },
      context?: ContextBrainSupplierFireworks,
    ): Promise<BrainOutput<TOutput, 'atom', TPlugs>> => {
      // track start time for elapsed duration
      const startedAt = Date.now();

      // compose system prompt from briefs
      const systemPrompt = askInput.role.briefs
        ? await castBriefsToPrompt({ briefs: askInput.role.briefs })
        : undefined;

      // get credentials via context (keyrack shorthand or getter)
      const supplier = context?.['brain.supplier.fireworks'];
      if (!supplier?.creds)
        throw new BadRequestError(
          'FIREWORKS_API_KEY required — provide via context',
        );
      const creds = await getSdkCredsFromBrainSupplies({
        creds: supplier.creds,
        keys: ['FIREWORKS_API_KEY'],
      });
      const openai = new OpenAI({
        apiKey: creds.FIREWORKS_API_KEY,
        baseURL: 'https://api.fireworks.ai/inference/v1',
      });

      // build messages array with prior exchanges for continuation
      const messages: OpenAI.ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      if (askInput.on?.episode) {
        for (const exchange of askInput.on.episode.exchanges) {
          messages.push({ role: 'user', content: exchange.input });
          messages.push({ role: 'assistant', content: exchange.output });
        }
      }

      // handle prompt: string or BrainPlugToolExecution[]
      const promptIsToolExecutions = Array.isArray(askInput.prompt);
      if (promptIsToolExecutions) {
        // tool continuation: add assistant message with tool_calls, then tool messages
        const executions = askInput.prompt as BrainPlugToolExecution[];

        // reconstruct assistant message with tool_calls from prior exchange
        // note: this is needed because fireworks ai expects the assistant message before tool messages
        const toolCalls: OpenAI.ChatCompletionMessageToolCall[] =
          executions.map((exec) => ({
            id: exec.exid,
            type: 'function' as const,
            function: {
              name: exec.slug,
              arguments: JSON.stringify(exec.input),
            },
          }));

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        });

        // add tool result messages
        const toolMessages = castIntoFireworksToolMessages({ executions });
        messages.push(...toolMessages);
      } else {
        // regular prompt
        messages.push({ role: 'user', content: askInput.prompt as string });
      }

      // convert zod schema to json schema for structured output
      const jsonSchema = z.toJSONSchema(askInput.schema.output);

      // convert tools to fireworks ai format if plugged
      const tools = askInput.plugs?.tools?.map((tool) =>
        castIntoFireworksToolDef({ tool }),
      );

      // determine if tools are present and whether this is a continuation
      const hasTools = tools && tools.length > 0;
      const isToolContinuation = promptIsToolExecutions;

      // fail-fast: tools + structured output schema not supported by most models
      // vllm constraint: "model must not generate both text and tool calls in same generation"
      // when tools are plugged, output schema must be z.string() to allow plain text responses
      if (hasTools && !isToolContinuation) {
        const schemaType = jsonSchema.type;
        if (schemaType !== 'string') {
          throw new BadRequestError(
            `when tools are plugged, output schema must be z.string() (found: ${schemaType}). most open-source models support either tool_calls or structured json, but not both. use z.string() and parse the response yourself if structure is needed.`,
            { schemaType, tools: askInput.plugs?.tools?.map((t) => t.slug) },
          );
        }
      }

      // include response_format only when we want structured output
      // fireworks ai constraint: "cannot specify response format and function call at the same time"
      // so we must omit response_format entirely when tools are present (initial OR continuation)
      const wantStructuredOutput = !hasTools;

      // pin which replica serves this prefix, so the prompt cache can hit
      // .note = messages are composed static-first: the system prompt (stable
      //         per role) leads, prior exchanges follow, and the variable
      //         prompt lands last. that order is what makes the prefix worth a
      //         pin — a variable value ahead of the briefs would void every
      //         token behind it.
      const affinityKey = getOnePromptCacheAffinityKey({
        model: config.model,
        systemPrompt,
      });

      // .note = the catch NEVER swallows (`rule.forbid.failhide`). it recognizes
      //         exactly one case — a model withdrawn under an ambiguous
      //         retirement — and upgrades fireworks' opaque `404 Model not
      //         found` into an error that names the successors to choose from.
      //         every other error rethrows untouched.
      const response = await (async () => {
        try {
          return await openai.chat.completions.create(
            {
              model: config.model,
              messages,
              ...(hasTools ? { tools, tool_choice: 'auto' as const } : {}),
              ...(wantStructuredOutput
                ? {
                    response_format: {
                      type: 'json_schema',
                      json_schema: {
                        name: 'response',
                        strict: true,
                        schema: jsonSchema,
                      },
                    },
                  }
                : {}),
            },
            {
              headers: affinityKey
                ? { 'x-session-affinity': affinityKey }
                : undefined,
            },
          );
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          throw getOneRetirementError({ slug, error }) ?? error;
        }
      })();

      // extract response message
      const message = response.choices[0]?.message;
      const content = message?.content ?? '';
      const toolCalls = message?.tool_calls;

      // calculate elapsed time
      const elapsedMs = Date.now() - startedAt;

      // read the token counts, disjoint, so each token is billed exactly once
      const sizeTokens = asBrainSizeTokens({ usage: response.usage });

      // calculate character counts
      const promptLength = promptIsToolExecutions
        ? JSON.stringify(askInput.prompt).length
        : (askInput.prompt as string).length;
      const charsInput = (systemPrompt?.length ?? 0) + promptLength;
      const charsOutput = content.length;

      // define size for metrics and cost calculation
      const size = {
        tokens: sizeTokens,
        chars: {
          input: charsInput,
          output: charsOutput,
          cache: { get: 0, set: 0 },
        },
      };

      // calculate cash costs via rhachet utility
      const { cash } = calcBrainOutputCost({
        for: { tokens: size.tokens },
        with: { cost: { cash: config.spec.cost.cash } },
      });

      // build metrics
      const metrics = new BrainOutputMetrics({
        size,
        cost: {
          time: { milliseconds: elapsedMs },
          cash,
        },
      });

      // handle tool calls if present
      if (toolCalls && toolCalls.length > 0) {
        // brain requested tool invocations
        const invocations: BrainPlugToolInvocation[] = toolCalls.map(
          (toolCall) => castFromFireworksToolCall({ toolCall }),
        );

        // build continuables for tool call exchange
        const { episode, series } = await genBrainContinuables({
          for: { grain: 'atom' },
          on: { episode: askInput.on?.episode ?? null, series: null },
          with: {
            exchange: {
              input: promptIsToolExecutions
                ? JSON.stringify(askInput.prompt)
                : (askInput.prompt as string),
              output: JSON.stringify(toolCalls),
              exid: response.id ?? null,
            },
            episode: { exid: response.id ?? null },
          },
        });

        // note: cast input because TypeScript can't verify conditional types at construction
        return new BrainOutput({
          output: null,
          calls: { tools: invocations },
          metrics,
          episode,
          series,
        } as unknown as BrainOutput<TOutput, 'atom', TPlugs>);
      }

      // parse response content based on schema type
      const output = castContentToOutputSchema({
        content,
        schema: askInput.schema.output,
      });

      // build continuables (episode + series) for this invocation
      const { episode, series } = await genBrainContinuables({
        for: { grain: 'atom' },
        on: { episode: askInput.on?.episode ?? null, series: null },
        with: {
          exchange: {
            input: promptIsToolExecutions
              ? JSON.stringify(askInput.prompt)
              : (askInput.prompt as string),
            output: content,
            exid: response.id ?? null,
          },
          episode: { exid: response.id ?? null },
        },
      });

      // note: cast input because TypeScript can't verify conditional types at construction
      return new BrainOutput({
        output,
        calls: null,
        metrics,
        episode,
        series,
      } as unknown as BrainOutput<TOutput, 'atom', TPlugs>);
    },
  });
};
