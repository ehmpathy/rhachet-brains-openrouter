import { ConstraintError } from 'helpful-errors';
import type { BrainPlugToolDefinition } from 'rhachet/brains';
import { getError } from 'test-fns';
import { z } from 'zod';

import { asToolSlugByName } from './asToolSlugByName';

/**
 * .what = a minimal tool, by slug
 * .why = the map reads only the slug
 */
const genTool = (input: { slug: string }): BrainPlugToolDefinition => ({
  slug: input.slug,
  name: input.slug,
  description: 'a test tool',
  schema: { input: z.object({}), output: z.object({}) },
});

describe('asToolSlugByName', () => {
  test('each plugged slug is keyed by the name it is sent under', () => {
    expect(
      asToolSlugByName({
        tools: [
          genTool({ slug: 'weather.lookup' }),
          genTool({ slug: 'calculator' }),
        ],
      }),
    ).toEqual({ weather_lookup: 'weather.lookup', calculator: 'calculator' });
  });

  test('no tools yields an empty map', () => {
    expect(asToolSlugByName({ tools: [] })).toEqual({});
  });

  test('two slugs that send under one name are refused, and both named', async () => {
    const error = await getError(() =>
      asToolSlugByName({
        tools: [
          genTool({ slug: 'weather.lookup' }),
          genTool({ slug: 'weather_lookup' }),
        ],
      }),
    );
    expect(error).toBeInstanceOf(ConstraintError);
    expect(error.message).toContain("'weather.lookup'");
    expect(error.message).toContain("'weather_lookup'");
    expect(error.message).toMatchSnapshot();
  });
});
