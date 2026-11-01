import type { HostFault } from '../../domain.objects/HostFault';
import { setHostFaultNoted } from './setHostFaultNoted';

/**
 * .what = an in-memory cache fake that records each call
 * .why = the leaf's whole effect is which cache call it makes; a fake shows it
 */
const genCacheFake = () => {
  const calls: { method: string; model: string; tag: string | null }[] = [];
  return {
    calls,
    sdkOpenRouterEndpoints: {
      delForModel: async (input: { model: string }) => {
        calls.push({ method: 'delForModel', model: input.model, tag: null });
      },
      setJsonIgnoredTag: async (input: { model: string; tag: string }) => {
        calls.push({
          method: 'setJsonIgnoredTag',
          model: input.model,
          tag: input.tag,
        });
      },
    },
  };
};

const TEST_CASES: {
  description: string;
  given: { fault: HostFault; tag: string | null };
  expect: { methods: string[] };
}[] = [
  {
    description: 'a refusal drops the stale endpoint list',
    given: { fault: 'refused', tag: 'chutes' },
    expect: { methods: ['delForModel'] },
  },
  {
    description: 'a refusal that names no host still drops the stale list',
    given: { fault: 'refused', tag: null },
    expect: { methods: ['delForModel'] },
  },
  {
    description: 'a prose reply marks the host json-ignored',
    given: { fault: 'prose', tag: 'chutes' },
    expect: { methods: ['setJsonIgnoredTag'] },
  },
  {
    description: 'an empty reply marks the host',
    given: { fault: 'empty', tag: 'chutes' },
    expect: { methods: ['setJsonIgnoredTag'] },
  },
  {
    description: 'a json-ignored fault with no host named marks naught',
    given: { fault: 'prose', tag: null },
    expect: { methods: [] },
  },
  {
    description: 'a stall proves naught about the cache',
    given: { fault: 'stalled', tag: 'chutes' },
    expect: { methods: [] },
  },
  {
    description: 'a throttle proves naught about the cache',
    given: { fault: 'throttled', tag: 'chutes' },
    expect: { methods: [] },
  },
];

describe('setHostFaultNoted', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, async () => {
      const fake = genCacheFake();
      await setHostFaultNoted(
        { ...thisCase.given, model: 'deepseek/deepseek-v4.1-flash' },
        fake,
      );
      expect(fake.calls.map((c) => c.method)).toEqual(thisCase.expect.methods);
    }),
  );
});
