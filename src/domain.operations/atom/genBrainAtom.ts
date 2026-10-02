import { ConstraintError, UnexpectedCodePathError } from 'helpful-errors';
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

import { asBrainPlugToolInvocationFromOpenRouter } from '../../infra/cast/asBrainPlugToolInvocationFromOpenRouter';
import { asOpenRouterMessages } from '../../infra/cast/asOpenRouterMessages';
import { asOpenRouterToolDef } from '../../infra/cast/asOpenRouterToolDef';
import { asOutputFromContent } from '../../infra/cast/asOutputFromContent';
import { asToolSlugByName } from '../../infra/cast/asToolSlugByName';
import { isStringLikeJsonSchema } from '../../infra/cast/isStringLikeJsonSchema';
import { asReplyChoice } from '../supply/asReplyChoice';
import { getOneSuppliedCompletion } from '../supply/getOneSuppliedCompletion';
import { sdkOpenRouterEndpoints } from '../supply/sdkOpenRouterEndpoints';
import { asAskNeeds } from './asAskNeeds';
import { asAtomTarget } from './asAtomTarget';
import { asBrainSizeForAsk } from './asBrainSizeForAsk';
import { asCashWithSupplyTotal } from './asCashWithSupplyTotal';
import { asPromptText } from './asPromptText';
import type { BrainSuppliesOpenRouter } from './BrainAtom.config';
import { getOneAskErrorNamed } from './getOneAskErrorNamed';
import { getOneCatalogModel } from './getOneCatalogModel';
import { getOneTierModel } from './getOneTierModel';
import type {
  BrainAtomSlugOpenRouter,
  BrainAtomSlugOpenRouterFiltered,
} from './slug/AtomSlug';
import type { BrainAtomSlugOpenRouterUnlisted } from './slug/AtomSlug.unlisted';

// re-export for consumers
export type { BrainSuppliesOpenRouter } from './BrainAtom.config';
export type {
  BrainAtomSlugOpenRouter,
  BrainAtomSlugOpenRouterFiltered,
} from './slug/AtomSlug';
export type { BrainAtomSlugOpenRouterUnlisted } from './slug/AtomSlug.unlisted';

/**
 * .what = typed context for the openrouter brain supplier
 * .why = enables type-safe credential injection via genContextBrainSupplier('openrouter', ...)
 */
export type ContextBrainSupplierOpenRouter = ContextBrainSupplier<
  'openrouter',
  BrainSuppliesOpenRouter
>;

/**
 * .what = factory to generate openrouter brain atom instances
 * .why = enables model variant selection via slug
 *
 * .note = the openrouter api is openai-compatible with a baseURL override
 *
 * .note = a tier slug reaches the newest model of its line, read from
 *         openrouter's catalog at ask and held 7 days on this machine
 *         (`getOneTierModel`). no version lives in this package
 *
 * .example
 *   genBrainAtom({ slug: 'openrouter/deepseek/flash' })                 // a tier: floor, ≥ 50 tps, full privacy
 *   genBrainAtom({ slug: 'openrouter/deepseek/flash/region=usa' })      // a tier, with filters of its own
 *   genBrainAtom({ slug: 'openrouter/acme/new-model' })                 // any openrouter id, unlisted, no release
 *
 * .note = an unlisted id is checked against openrouter's catalog at ask time,
 *         before any spend. every spec is an estimate; the real charge lands
 *         in `metrics.cost.cash.total`
 *
 * .note = every atom carries the name it was built from as `atom.slug`, so a
 *         consumer who selects by that name finds it.
 */
export const genBrainAtom = (input: {
  slug:
    | BrainAtomSlugOpenRouter
    | BrainAtomSlugOpenRouterFiltered
    | BrainAtomSlugOpenRouterUnlisted;
}): BrainAtom<ContextBrainSupplierOpenRouter> => {
  // cast the slug onto the model it names; a bad slug is refused here
  const target = asAtomTarget({ slug: input.slug });

  return new BrainAtom({
    repo: 'openrouter',
    // 🔴 .note = the atom keeps the EXACT name it was built from — tier,
    //         filtered, or unlisted alike. a registry selects by `atom.slug`,
    //         so a renamed atom is one no consumer can choose by the name they
    //         hold (`rule.require.versionless-slugs-selectable`). the model it
    //         reached rides back in `output.supply`
    slug: input.slug,
    description: target.description,
    // .note = the rate is an ESTIMATE; the served endpoint's charge lands in
    //         `metrics.cost.cash.total` after the ask
    spec: target.spec,

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
      context?: ContextBrainSupplierOpenRouter,
    ): Promise<BrainOutput<TOutput, 'atom', TPlugs>> => {
      // track start time for elapsed duration
      const startedAt = Date.now();

      // compose system prompt from briefs
      const systemPrompt = askInput.role.briefs
        ? await castBriefsToPrompt({ briefs: askInput.role.briefs })
        : undefined;

      // get credentials via context (keyrack shorthand or getter)
      const supplier = context?.['brain.supplier.openrouter'];
      if (!supplier?.creds)
        throw new ConstraintError(
          [
            'OPENROUTER_API_KEY required — provide via context. no call was sent.',
            '',
            "fix: pass genContextBrainSupplier('openrouter', { creds: { keyrack: { owner: 'ehmpath', env: 'prod' } } })",
          ].join('\n'),
        );
      const creds = await getSdkCredsFromBrainSupplies({
        creds: supplier.creds,
        keys: ['OPENROUTER_API_KEY'],
      });
      const openai = new OpenAI({
        apiKey: creds.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      });

      // name the model: a tier reads its newest model, an unlisted id is
      // checked against the catalog; either is refused before any spend
      const model = target.tier
        ? await getOneTierModel(
            { tier: target.tier, apiKey: creds.OPENROUTER_API_KEY },
            { sdkOpenRouterEndpoints },
          )
        : await getOneCatalogModel(
            {
              model:
                target.model ??
                UnexpectedCodePathError.throw('target names no model', {
                  target,
                }),
              filterSuffix: target.filterSuffix,
              apiKey: creds.OPENROUTER_API_KEY,
            },
            { sdkOpenRouterEndpoints },
          );

      // the messages: system prompt, prior exchanges, then this turn
      const messages = asOpenRouterMessages({
        systemPrompt: systemPrompt ?? null,
        exchanges: askInput.on?.episode?.exchanges ?? [],
        prompt: askInput.prompt,
      });
      const promptIsToolExecutions = Array.isArray(askInput.prompt);
      const promptText = asPromptText({ prompt: askInput.prompt });

      // convert zod schema to json schema; a string-like schema wants plain text
      const jsonSchema = z.toJSONSchema(askInput.schema.output);
      const isStringLike = isStringLikeJsonSchema({ jsonSchema });

      // convert tools to openrouter format if plugged; a name maps back to its slug
      const slugByName = asToolSlugByName({
        tools: askInput.plugs?.tools ?? [],
      });
      const tools = askInput.plugs?.tools?.map((tool) =>
        asOpenRouterToolDef({ tool }),
      );

      // determine if tools are present and whether this is a continuation
      const hasTools = tools && tools.length > 0;
      const isToolContinuation = promptIsToolExecutions;

      // fail-fast: tools + structured output schema not supported by most models
      // vllm constraint: "model must not generate both text and tool calls in same generation"
      // when tools are plugged, output schema must be string-like to allow plain text responses
      if (hasTools && !isToolContinuation && !isStringLike) {
        const schemaType = jsonSchema.type;
        throw new ConstraintError(
          `when tools are plugged, output schema must be z.string() (found: ${schemaType}). most open-source models support either tool_calls or structured json, but not both. use z.string() and parse the response yourself if structure is needed.`,
          { schemaType, tools: askInput.plugs?.tools?.map((t) => t.slug) },
        );
      }

      // name what the ask needs of its endpoint: json, tools, or neither
      const { structuredOutput: wantStructuredOutput, paramsRequired } =
        asAskNeeds({ hasTools: !!hasTools, isStringLike });

      // .note = the catch NEVER swallows (`rule.forbid.failhide`). it recognizes
      //         two cases and names the fix for each: an account fault (402 no
      //         credits, 401 bad key), and a model openrouter has withdrawn (a
      //         refusal, confirmed by the catalog; names the nearest live ids).
      //         every other error rethrows untouched.
      const { response, supply, costUsd } = await (async () => {
        try {
          return await getOneSuppliedCompletion(
            {
              apiKey: creds.OPENROUTER_API_KEY,
              model,
              filters: target.filters,
              paramsRequired,
              expectsJson: wantStructuredOutput,
              request: {
                model,
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
            },
            { openai, sdkOpenRouterEndpoints },
          );
        } catch (error) {
          // name the cause where it is known; else rethrow as it came
          throw await getOneAskErrorNamed(
            {
              error,
              model,
              filterSuffix: target.filterSuffix,
              apiKey: creds.OPENROUTER_API_KEY,
            },
            { sdkOpenRouterEndpoints },
          );
        }
      })();

      // extract response message
      const message = asReplyChoice({ response })?.message;
      const content = message?.content ?? '';
      const toolCalls = message?.tool_calls;

      // calculate elapsed time
      const elapsedMs = Date.now() - startedAt;

      // the size of this ask: tokens as billed, disjoint; chars in and out
      const size = asBrainSizeForAsk({
        usage: response.usage,
        systemPrompt: systemPrompt ?? null,
        promptText,
        content,
      });

      // estimate the breakdown from the spec rate; the total is openrouter's charge
      const { cash: cashEstimate } = calcBrainOutputCost({
        for: { tokens: size.tokens },
        with: { cost: { cash: target.spec.cost.cash } },
      });
      const cash = asCashWithSupplyTotal({
        estimate: cashEstimate,
        costUsd,
      });

      // build metrics: rhachet's declared measures only
      // .note = the supply report rides as `output.supply`, beside rhachet's
      //         declared fields, until rhachet declares a typed slot for it
      const metrics = new BrainOutputMetrics({
        size,
        cost: { time: { milliseconds: elapsedMs }, cash },
      });

      // handle tool calls if present
      if (toolCalls && toolCalls.length > 0) {
        // brain requested tool invocations
        const invocations: BrainPlugToolInvocation[] = toolCalls.map(
          (toolCall) =>
            asBrainPlugToolInvocationFromOpenRouter({ toolCall, slugByName }),
        );

        // build continuables for tool call exchange
        const { episode, series } = await genBrainContinuables({
          for: { grain: 'atom' },
          on: { episode: askInput.on?.episode ?? null, series: null },
          with: {
            exchange: {
              input: promptText,
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
          supply,
          episode,
          series,
        } as unknown as BrainOutput<TOutput, 'atom', TPlugs>);
      }

      // parse response content based on schema type
      const output = asOutputFromContent({
        content,
        schema: askInput.schema.output,
      });

      // build continuables (episode + series) for this invocation
      const { episode, series } = await genBrainContinuables({
        for: { grain: 'atom' },
        on: { episode: askInput.on?.episode ?? null, series: null },
        with: {
          exchange: {
            input: promptText,
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
        supply,
        episode,
        series,
      } as unknown as BrainOutput<TOutput, 'atom', TPlugs>);
    },
  });
};
