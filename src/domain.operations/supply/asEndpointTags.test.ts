import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asEndpointTags } from './asEndpointTags';

const genEndpoint = (input: { tag: string }): OpenRouterEndpoint => ({
  providerName: input.tag,
  tag: input.tag,
  quantization: 'fp8',
  supportedParameters: [],
  pricePromptUsdPerToken: 0.0000001,
  priceCompletionUsdPerToken: 0.0000002,
  throughputTps: 60,
  maxCompletionTokens: null,
  zdr: true,
});

describe('asEndpointTags', () => {
  test('names each host by tag, in the order given', () => {
    expect(
      asEndpointTags({
        endpoints: [
          genEndpoint({ tag: 'quick' }),
          genEndpoint({ tag: 'cheap' }),
        ],
      }),
    ).toEqual(['quick', 'cheap']);
  });

  test('no endpoints name no tags', () => {
    expect(asEndpointTags({ endpoints: [] })).toEqual([]);
  });
});
