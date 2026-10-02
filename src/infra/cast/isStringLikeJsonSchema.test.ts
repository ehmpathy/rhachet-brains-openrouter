import { z } from 'zod';

import { isStringLikeJsonSchema } from './isStringLikeJsonSchema';

const TEST_CASES = [
  {
    description: 'a plain string is string-like',
    given: z.string(),
    expect: true,
  },
  {
    description: 'a nullable string is string-like',
    given: z.string().nullable(),
    expect: true,
  },
  {
    description: 'an object is not string-like',
    given: z.object({ city: z.string() }),
    expect: false,
  },
  {
    description: 'a nullable number is not string-like',
    given: z.number().nullable(),
    expect: false,
  },
  {
    description: 'a string-or-number union is not string-like',
    given: z.union([z.string(), z.number()]),
    expect: false,
  },
];

describe('isStringLikeJsonSchema', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(
        isStringLikeJsonSchema({ jsonSchema: z.toJSONSchema(thisCase.given) }),
      ).toEqual(thisCase.expect);
    }),
  );
});
