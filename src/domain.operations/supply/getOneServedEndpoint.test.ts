import { MalfunctionError } from 'helpful-errors';
import { getError } from 'test-fns';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { getOneServedEndpoint } from './getOneServedEndpoint';

// .why = case=22: an answer from a provider outside the admitted set is withheld
const ADMITTED: OpenRouterEndpoint[] = [
  {
    providerName: 'DeepInfra',
    tag: 'deepinfra/us',
    quantization: 'fp8',
    supportedParameters: [],
    pricePromptUsdPerToken: 0.0000001,
    priceCompletionUsdPerToken: 0.0000001,
    throughputTps: 90,
    zdr: true,
  },
];

describe('getOneServedEndpoint', () => {
  test('an answer from the admitted provider returns that endpoint', () => {
    const served = getOneServedEndpoint({
      provider: 'DeepInfra',
      admitted: ADMITTED,
      generationId: 'gen-1',
    });
    expect(served.tag).toEqual('deepinfra/us');
  });

  test('an answer from another provider is withheld, loud', async () => {
    const error = await getError(async () =>
      getOneServedEndpoint({
        provider: 'AtlasCloud',
        admitted: ADMITTED,
        generationId: 'gen-1',
      }),
    );
    expect(error).toBeInstanceOf(MalfunctionError);
    expect(error.message).toContain('the answer is withheld');
    expect(error.message).toContain("served from 'AtlasCloud'");
    expect(error.message).toContain("admitted only 'deepinfra/us'");
    expect(error.message).toContain('generation gen-1');
    expect(error.message).toMatchSnapshot();
  });

  // .why = measured 2026-10-02: three review lanes failed with "served from
  //        'null'", which reads as a breach. a reply with no provider proves
  //        neither a breach nor a keep, so it is withheld under its own name
  test('an answer that names no provider is withheld, and never called a breach', async () => {
    const error = await getError(async () =>
      getOneServedEndpoint({
        provider: null,
        admitted: ADMITTED,
        generationId: 'gen-1',
      }),
    );
    expect(error).toBeInstanceOf(MalfunctionError);
    expect(error.message).toContain('named no provider');
    expect(error.message).not.toContain('served from');
    expect(error.message).toContain('generation gen-1');
    expect(error.message).toMatchSnapshot();
  });
});
