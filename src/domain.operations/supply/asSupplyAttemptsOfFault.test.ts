import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asSupplyAttemptsOfFault } from './asSupplyAttemptsOfFault';

const genEndpoint = (input: { tag: string }): OpenRouterEndpoint => ({
  providerName: 'A',
  tag: input.tag,
  quantization: null,
  supportedParameters: [],
  pricePromptUsdPerToken: 0.00000003,
  priceCompletionUsdPerToken: 0.0000005,
  throughputTps: 120,
  maxCompletionTokens: null,
  zdr: true,
});

const TEST_CASES: {
  description: string;
  given: Parameters<typeof asSupplyAttemptsOfFault>[0];
  expect: { output: ReturnType<typeof asSupplyAttemptsOfFault> };
}[] = [
  {
    description: 'one attempt per endpoint removed, each with the outcome',
    given: {
      endpoints: [
        genEndpoint({ tag: 'a/fp8' }),
        genEndpoint({ tag: 'a/bf16' }),
      ],
      outcome: 'throttled',
    },
    expect: {
      output: [
        { tag: 'a/fp8', outcome: 'throttled' },
        { tag: 'a/bf16', outcome: 'throttled' },
      ],
    },
  },
  {
    description: 'no endpoint removed, no attempt',
    given: { endpoints: [], outcome: 'failed' },
    expect: { output: [] },
  },
];

describe('asSupplyAttemptsOfFault', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asSupplyAttemptsOfFault(thisCase.given)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
