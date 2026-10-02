import { asOpenRouterToolName } from './asOpenRouterToolName';

const TEST_CASES = [
  {
    description: 'a slug already in the charset is sent as is',
    given: { slug: 'get_wave-report2' },
    expect: { output: 'get_wave-report2' },
  },
  {
    description: 'a dot becomes an underscore (measured: decart refuses a dot)',
    given: { slug: 'weather.lookup' },
    expect: { output: 'weather_lookup' },
  },
  {
    description: 'every disallowed char becomes an underscore',
    given: { slug: 'surf/spot report:v2' },
    expect: { output: 'surf_spot_report_v2' },
  },
  {
    description: 'a name past 64 chars is cut to 64',
    given: { slug: 'a'.repeat(80) },
    expect: { output: 'a'.repeat(64) },
  },
];

describe('asOpenRouterToolName', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const output = asOpenRouterToolName(thisCase.given);
      expect(output).toEqual(thisCase.expect.output);
      expect(output).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }),
  );
});
