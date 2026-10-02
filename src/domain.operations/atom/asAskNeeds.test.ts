import { asAskNeeds } from './asAskNeeds';

describe('asAskNeeds', () => {
  const TEST_CASES = [
    {
      description:
        'an object schema, no tools: json, and an endpoint that honors it',
      given: { hasTools: false, isStringLike: false },
      expect: {
        structuredOutput: true,
        paramsRequired: ['response_format', 'structured_outputs'],
      },
    },
    {
      description: 'a string-like schema needs no constraint at all (F21)',
      given: { hasTools: false, isStringLike: true },
      expect: { structuredOutput: false, paramsRequired: [] },
    },
    {
      description:
        'tools never ask for json too; upstream refuses both at once',
      given: { hasTools: true, isStringLike: false },
      expect: { structuredOutput: false, paramsRequired: ['tools'] },
    },
    {
      description: 'tools with a string-like schema need only tools',
      given: { hasTools: true, isStringLike: true },
      expect: { structuredOutput: false, paramsRequired: ['tools'] },
    },
  ];

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asAskNeeds(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
