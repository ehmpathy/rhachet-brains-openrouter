import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asEndpointsSplitByProvider } from './asEndpointsSplitByProvider';

const genEndpoint = (input: {
  providerName: string;
  tag: string;
}): OpenRouterEndpoint => ({
  providerName: input.providerName,
  tag: input.tag,
  quantization: null,
  supportedParameters: [],
  pricePromptUsdPerToken: 0.00000003,
  priceCompletionUsdPerToken: 0.0000005,
  throughputTps: 120,
  zdr: true,
});

const A_FP8 = genEndpoint({ providerName: 'A', tag: 'a/fp8' });
const A_BF16 = genEndpoint({ providerName: 'A', tag: 'a/bf16' });
const B = genEndpoint({ providerName: 'B', tag: 'b' });

const TEST_CASES: {
  description: string;
  given: { endpoints: OpenRouterEndpoint[]; providerName: string | null };
  expect: { named: OpenRouterEndpoint[]; others: OpenRouterEndpoint[] };
}[] = [
  {
    description: 'every endpoint of the named provider is named, in order',
    given: { endpoints: [A_FP8, B, A_BF16], providerName: 'A' },
    expect: { named: [A_FP8, A_BF16], others: [B] },
  },
  {
    description: 'a provider outside the set names no endpoint',
    given: { endpoints: [A_FP8, B], providerName: 'Stranger' },
    expect: { named: [], others: [A_FP8, B] },
  },
  {
    description: 'a null provider names no endpoint',
    given: { endpoints: [A_FP8, B], providerName: null },
    expect: { named: [], others: [A_FP8, B] },
  },
  {
    description: 'an empty set splits into two empty sets',
    given: { endpoints: [], providerName: 'A' },
    expect: { named: [], others: [] },
  },
];

describe('asEndpointsSplitByProvider', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asEndpointsSplitByProvider(thisCase.given)).toEqual(
        thisCase.expect,
      );
    }),
  );
});
