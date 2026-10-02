/**
 * .what = one openrouter endpoint of a model: a provider that serves it, at a price and a speed
 * .why = the supply promises (speed, region, precision, privacy, price) are checked against
 *        these fields; the floor ranks by them
 */
export type OpenRouterEndpoint = {
  providerName: string;
  tag: string;
  quantization: string | null;
  supportedParameters: string[];
  pricePromptUsdPerToken: number;
  priceCompletionUsdPerToken: number;
  throughputTps: number | null;
  zdr: boolean; // on openrouter's zero-data-retention list
};
