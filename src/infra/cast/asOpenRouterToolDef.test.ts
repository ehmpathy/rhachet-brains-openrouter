import { z } from 'zod';

import { asOpenRouterToolDef } from './asOpenRouterToolDef';

describe('asOpenRouterToolDef', () => {
  test('a tool becomes a strict function, its zod input as json schema', () => {
    const def = asOpenRouterToolDef({
      tool: {
        slug: 'getWaveReport',
        name: 'get wave report',
        description: 'the wave report for a surf spot',
        schema: {
          input: z.object({ spot: z.string() }),
          output: z.object({ heightFt: z.number() }),
        },
      },
    });
    expect(def.type).toEqual('function');
    expect(def).toMatchObject({
      function: {
        name: 'getWaveReport',
        description: 'the wave report for a surf spot',
        strict: true,
        parameters: {
          type: 'object',
          properties: { spot: { type: 'string' } },
          required: ['spot'],
        },
      },
    });
  });

  // 🔴 .why = a strict host refuses the whole ask on a dot in a function name
  //           (measured 2026-10-02, decart: 400 backend_invalid_argument)
  test('a slug with a dot is sent under a name in the function charset', () => {
    const def = asOpenRouterToolDef({
      tool: {
        slug: 'weather.lookup',
        name: 'weather lookup',
        description: 'get current weather for a city',
        schema: {
          input: z.object({ city: z.string() }),
          output: z.object({ temp: z.number() }),
        },
      },
    });
    expect(def.function.name).toEqual('weather_lookup');
  });
});
