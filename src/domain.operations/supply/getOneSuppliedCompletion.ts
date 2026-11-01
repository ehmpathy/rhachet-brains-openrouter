import type OpenAI from 'openai';

import type { OpenRouterReasoning } from '../../domain.objects/OpenRouterReasoning';
import type { SupplyReport } from '../../domain.objects/SupplyReport';
import { asRankedReport } from './asRankedReport';
import { asSupplyFactsFromReply } from './asSupplyFactsFromReply';
import type { SupplyFilters } from './asSupplyFilters';
import { asThoughtLevel } from './asThoughtLevel';
import { asTokensThoughtBudget } from './asTokensThoughtBudget';
import { getAllQualifiedEndpoints } from './getAllQualifiedEndpoints';
import { getOneAdmittedSetCompletion } from './getOneAdmittedSetCompletion';
import { getOneFloorCompletion } from './getOneFloorCompletion';
import { getOneReplyDefectError } from './getOneReplyDefectError';
import { getOneServedEndpoint } from './getOneServedEndpoint';
import { getOneTokensEstimate } from './getOneTokensEstimate';
import { HOP_STALL_BOUND } from './HOP_STALL_BOUND';
import type { SdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';

type ChatRequest = OpenAI.ChatCompletionCreateParamsNonStreaming; // .note = the openai sdk's own type name

/**
 * .what = sends one chat completion, supplied per the slug's filters
 * .why = every ask admits only endpoints that keep every promise, and checked
 *        after. a bare slug carries the default supply filters (asAtomTarget),
 *        so openrouter's balancer never picks the host
 *
 * .note = a reply unfit to read (failed mid-reply, cut off, empty where json is
 *         owed) is refused FIRST. such a reply can carry no `provider`, and the
 *         admit check would misread that as a breach
 * .note = the thought cap enters once, as `reasoning`; each of its uses derives here, so
 *         none can be sent without the others. it rides the request, it requires a host
 *         that lists `reasoning` (a host that does not could think to the limit, the harm
 *         the cap exists to stop, case=6), and it shapes the funnel and the all-thought fix
 */
export const getOneSuppliedCompletion = async (
  input: {
    apiKey: string;
    model: string;
    request: ChatRequest;
    filters: SupplyFilters;
    paramsRequired: string[];
    expectsJson: boolean;
    reasoning: OpenRouterReasoning | null; // the ask's thought cap; null = none set
  },
  context: {
    openai: OpenAI;
    sdkOpenRouterEndpoints: Pick<
      SdkOpenRouterEndpoints,
      | 'getAllForModel'
      | 'delForModel'
      | 'getAllJsonIgnoredTags'
      | 'setJsonIgnoredTag'
    >;
  },
): Promise<{
  response: OpenAI.ChatCompletion;
  supply: SupplyReport;
  costUsd: number | null; // openrouter's charge; feeds `metrics.cost.cash.total`
}> => {
  // derive each use of the thought cap from the one value
  const request: ChatRequest = {
    ...input.request,
    ...(input.reasoning ? { reasoning: input.reasoning } : {}), // .note = openrouter's field, absent from the sdk's type
  };
  const paramsRequired = input.reasoning
    ? [...input.paramsRequired, 'reasoning']
    : input.paramsRequired;
  const tokensThoughtBudget = asTokensThoughtBudget({
    reasoning: input.reasoning,
  });
  const thoughtLevel = asThoughtLevel({ reasoning: input.reasoning });

  // read the model's endpoints, each marked with its zdr membership
  const endpoints = await context.sdkOpenRouterEndpoints.getAllForModel({
    model: input.model,
    apiKey: input.apiKey,
  });

  // a json ask skips each host this machine saw answer prose in the last 7 days
  const tagsJsonIgnored = input.expectsJson
    ? await context.sdkOpenRouterEndpoints.getAllJsonIgnoredTags({
        model: input.model,
        tags: endpoints.map((endpoint) => endpoint.tag),
      })
    : [];

  // rank every endpoint by input cost, and keep only the qualified
  const tokensEstimate = getOneTokensEstimate({ request });
  const { qualified, funnel, verdicts } = getAllQualifiedEndpoints({
    model: input.model,
    endpoints,
    filters: input.filters,
    paramsRequired,
    tagsJsonIgnored,
    tokens: tokensEstimate,
    tokensThoughtBudget,
  });

  // floor: walk cheapest-first, one endpoint admitted per hop; else admit the whole qualified set at once
  const { response, admitted, attempts } = input.filters.floor
    ? await getOneFloorCompletion(
        {
          model: input.model,
          request,
          filters: input.filters,
          expectsJson: input.expectsJson,
          queue: qualified,
          attempts: [],
          retryAfter: null,
          faultLast: null,
          bound: HOP_STALL_BOUND,
        },
        context,
      )
    : await getOneAdmittedSetCompletion(
        {
          model: input.model,
          request,
          filters: input.filters,
          expectsJson: input.expectsJson,
          qualified,
          attempts: [],
          retryAfter: null,
          faultLast: null,
          bound: HOP_STALL_BOUND,
        },
        context,
      );

  // refuse a reply unfit to read, before the admit check can misread it
  const facts = asSupplyFactsFromReply({ response });
  const replyDefect = getOneReplyDefectError({
    response,
    supply: facts,
    expectsJson: input.expectsJson,
    tokensThoughtBudget,
    thoughtLevel,
  });
  if (replyDefect) throw replyDefect;

  // check the served provider against the admitted set, before the caller reads it
  const served = getOneServedEndpoint({
    provider: facts.provider,
    admitted,
    generationId: facts.generationId,
  });

  // report the choice: each promise's toll, and why each cheaper endpoint lost
  return {
    response,
    // .note = named fields, never a spread: the report holds exactly `SupplyReport`
    costUsd: facts.costUsd,
    supply: {
      provider: facts.provider,
      generationId: facts.generationId,
      // each endpoint tried, in order; the last one served, in both supply modes
      attempts: [...attempts, { tag: served.tag, outcome: 'served' }],
      choice: {
        tokensEstimate,
        sort: input.filters.sort,
        funnel,
        ranked: asRankedReport({ verdicts, servedTag: served.tag }),
      },
    },
  };
};
