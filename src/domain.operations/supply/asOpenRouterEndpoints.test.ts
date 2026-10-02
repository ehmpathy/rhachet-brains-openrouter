import { MalfunctionError } from 'helpful-errors';
import { getError } from 'test-fns';

import { asOpenRouterEndpoints } from './asOpenRouterEndpoints';

/**
 * .what = one raw endpoint, shaped as openrouter's `/models/:id/endpoints` returns it
 * .why = the cast reads openrouter's own field names; `pricing` among them
 */
const genRawEndpoint = (input: {
  throughput: unknown;
  tag?: string | null;
}) => ({
  provider_name: 'DeepInfra',
  tag: input.tag === undefined ? 'deepinfra/fp8' : input.tag,
  quantization: 'fp8',
  supported_parameters: ['tools', 'response_format'],
  pricing: { prompt: '0.00000027', completion: '0.0000011' },
  throughput_last_30m: input.throughput,
});

describe('asOpenRouterEndpoints', () => {
  const TEST_CASES = [
    {
      description: 'a bare-number throughput reads as the speed',
      given: { throughput: 88 },
      expect: { throughputTps: 88 },
    },
    {
      description: 'percentile throughput reads its p50',
      given: { throughput: { p50: 61, p90: 120 } },
      expect: { throughputTps: 61 },
    },
    {
      description:
        'an absent throughput reads as null, so a speed promise fails closed',
      given: { throughput: null },
      expect: { throughputTps: null },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const [endpoint] = asOpenRouterEndpoints({
        body: { data: { endpoints: [genRawEndpoint(thisCase.given)] } },
        model: 'deepseek/deepseek-v4.1-flash',
      });
      expect(endpoint?.throughputTps).toEqual(thisCase.expect.throughputTps);
    }),
  );

  test('the rates cast from openrouter strings to numbers, per token', () => {
    const [endpoint] = asOpenRouterEndpoints({
      body: { data: { endpoints: [genRawEndpoint({ throughput: 88 })] } },
      model: 'deepseek/deepseek-v4.1-flash',
    });
    expect(endpoint).toEqual({
      providerName: 'DeepInfra',
      tag: 'deepinfra/fp8',
      quantization: 'fp8',
      supportedParameters: ['tools', 'response_format'],
      pricePromptUsdPerToken: 0.00000027,
      priceCompletionUsdPerToken: 0.0000011,
      throughputTps: 88,
    });
  });

  test('an endpoint with no tag is tagged by its provider name', () => {
    const [endpoint] = asOpenRouterEndpoints({
      body: {
        data: { endpoints: [genRawEndpoint({ throughput: 88, tag: null })] },
      },
      model: 'deepseek/deepseek-v4.1-flash',
    });
    expect(endpoint?.tag).toEqual('DeepInfra');
  });

  test('a drifted body fails loud, and names the read', async () => {
    const error = await getError(() =>
      asOpenRouterEndpoints({
        body: { data: { endpoints: [{ provider_name: 'DeepInfra' }] } },
        model: 'deepseek/deepseek-v4.1-flash',
      }),
    );
    expect(error).toBeInstanceOf(MalfunctionError);
    expect(error.message).toContain(
      '/models/deepseek/deepseek-v4.1-flash/endpoints reply drifted',
    );
    expect(error.message).toContain('data.endpoints.0.pricing');
    expect(error.message).toMatchSnapshot();
  });
});
