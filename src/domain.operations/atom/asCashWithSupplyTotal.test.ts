import { asIsoPrice } from 'iso-price';

import { asCashWithSupplyTotal } from './asCashWithSupplyTotal';

const ESTIMATE = {
  total: asIsoPrice('USD 0.000050'),
  deets: {
    input: asIsoPrice('USD 0.000030'),
    output: asIsoPrice('USD 0.000020'),
    cache: { get: asIsoPrice('USD 0'), set: asIsoPrice('USD 0') },
  },
};

describe('asCashWithSupplyTotal', () => {
  test("openrouter's charge replaces the estimated total", () => {
    const cash = asCashWithSupplyTotal({
      estimate: ESTIMATE,
      costUsd: 0.0000412,
    });
    expect(cash.total).toEqual(asIsoPrice('USD 0.000041200'));
  });

  test('the breakdown stays the spec-rate estimate', () => {
    const cash = asCashWithSupplyTotal({
      estimate: ESTIMATE,
      costUsd: 0.0000412,
    });
    expect(cash.deets).toEqual(ESTIMATE.deets);
  });

  test('no charge sent keeps the estimated total', () => {
    const cash = asCashWithSupplyTotal({ estimate: ESTIMATE, costUsd: null });
    expect(cash.total).toEqual(ESTIMATE.total);
  });
});
