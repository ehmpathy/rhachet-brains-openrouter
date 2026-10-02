import { z } from 'zod';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asOpenRouterBodyChecked } from './asOpenRouterBodyChecked';

/**
 * .what = the fields this package reads from `/models/:id/endpoints`
 * .why = openrouter's own field names; each feeds a supply promise
 *
 * .note = `pricing` is openrouter's own field name
 * .note = throughput arrives as a number, as percentiles, or as null
 */
const SCHEMA_ENDPOINTS_BODY = z.object({
  data: z.object({
    endpoints: z.array(
      z.object({
        provider_name: z.string(),
        tag: z.string().nullish(),
        quantization: z.string().nullish(),
        supported_parameters: z.array(z.string()).nullish(),
        pricing: z.object({
          prompt: z.union([z.string(), z.number()]),
          completion: z.union([z.string(), z.number()]),
        }),
        throughput_last_30m: z
          .union([z.number(), z.object({ p50: z.number().nullish() })])
          .nullish(),
      }),
    ),
  }),
});

type RawEndpoint = z.infer<
  typeof SCHEMA_ENDPOINTS_BODY
>['data']['endpoints'][number];

/**
 * .what = an endpoint's speed, in tokens per second, as its 30-min p50
 * .why = openrouter reports either a bare number or percentiles; the speed
 *        promise reads the median
 */
const asThroughputTps = (input: {
  throughput: RawEndpoint['throughput_last_30m'];
}): number | null => {
  if (typeof input.throughput === 'number') return input.throughput;
  return input.throughput?.p50 ?? null;
};

/**
 * .what = the endpoints of one model, cast from openrouter's reply into our shape
 * .why = the supply promises are checked against these fields; a drifted reply
 *        fails loud rather than misroute (`asOpenRouterBodyChecked`)
 *
 * .note = `zdr` is absent here; it comes from a separate read, joined by the sdk
 */
export const asOpenRouterEndpoints = (input: {
  body: unknown;
  model: string;
}): Omit<OpenRouterEndpoint, 'zdr'>[] =>
  asOpenRouterBodyChecked({
    body: input.body,
    schema: SCHEMA_ENDPOINTS_BODY,
    read: `/models/${input.model}/endpoints`,
  }).data.endpoints.map((raw) => ({
    providerName: raw.provider_name,
    tag: raw.tag ?? raw.provider_name,
    quantization: raw.quantization ?? null,
    supportedParameters: raw.supported_parameters ?? [],
    pricePromptUsdPerToken: Number(raw.pricing.prompt),
    priceCompletionUsdPerToken: Number(raw.pricing.completion),
    throughputTps: asThroughputTps({ throughput: raw.throughput_last_30m }),
  }));
