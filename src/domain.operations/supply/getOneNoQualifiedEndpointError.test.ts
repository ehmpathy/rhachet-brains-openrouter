import { ConstraintError } from 'helpful-errors';

import type { OpenRouterEndpoint } from '../../domain.objects/OpenRouterEndpoint';
import { asSupplyFilters } from './asSupplyFilters';
import { getOneNoQualifiedEndpointError } from './getOneNoQualifiedEndpointError';

const genEndpoint = (input: {
  tag: string;
  pricePerMillion: number;
}): OpenRouterEndpoint => ({
  providerName: input.tag,
  tag: input.tag,
  quantization: 'fp8',
  supportedParameters: [],
  pricePromptUsdPerToken: input.pricePerMillion / 1e6,
  priceCompletionUsdPerToken: input.pricePerMillion / 1e6,
  throughputTps: 90,
  maxCompletionTokens: null,
  zdr: false,
});

const VERDICTS = [
  {
    endpoint: genEndpoint({ tag: 'cheap', pricePerMillion: 0.1 }),
    failed: 'privacy=full (zdr list)',
  },
  {
    endpoint: genEndpoint({ tag: 'dear', pricePerMillion: Number.NaN }),
    failed: 'privacy=full (zdr list)',
  },
];

const FUNNEL = [
  { promise: 'all endpoints', left: 2 },
  { promise: 'privacy=full (zdr list)', left: 0 },
];

describe('getOneNoQualifiedEndpointError', () => {
  const TEST_CASES = [
    {
      description: 'with no sort, the table heading reads cheapest first',
      given: { segment: 'privacy=full' },
      expect: { heading: 'cheapest input rate first' },
    },
    {
      description:
        'under sort=throughput, the table heading reads fastest first',
      given: { segment: 'privacy=full&sort=throughput' },
      expect: { heading: 'fastest first' },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const error = getOneNoQualifiedEndpointError({
        model: 'deepseek/deepseek-v4.1-flash',
        filters: asSupplyFilters({ segment: thisCase.given.segment }),
        funnel: FUNNEL,
        verdicts: VERDICTS,
        fix: 'fix: drop or loosen the promise where the count reaches 0',
      });
      expect(error).toBeInstanceOf(ConstraintError);
      expect(error.message).toContain(thisCase.expect.heading);
      expect(error.message).toContain('  0 ← privacy=full (zdr list)');
      expect(error.message).toContain('no rate');
      expect(error.message).toMatchSnapshot();
    }),
  );
});
