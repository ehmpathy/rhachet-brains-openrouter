import { ConstraintError } from 'helpful-errors';
import { genContextBrainSupplier } from 'rhachet';
import { getError, given, then, when } from 'test-fns';
import { z } from 'zod';

import { type BrainSuppliesOpenRouter, genBrainAtom } from './genBrainAtom';

if (!process.env.OPENROUTER_API_KEY)
  throw new ConstraintError(
    'OPENROUTER_API_KEY is required for integration tests',
    {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
      env: 'OPENROUTER_API_KEY',
    },
  );

// store the real api key for test context suppliers
const realApiKey = process.env.OPENROUTER_API_KEY;

describe('genBrainAtom.credentials.integration', () => {
  // .note = matches genBrainAtom.integration.test.ts. cases 2 and 4 each make
  //         2 sequential real calls; a single call can take tens of seconds
  //         on a slow host, so 90s leaves headroom for two in sequence
  jest.setTimeout(90000);

  given('[case1] context with creds getter', () => {
    when('[t0] ask is called with context supplier', () => {
      then('creds getter is called and used', async () => {
        // track getter invocations
        let getterCallCount = 0;

        const context = genContextBrainSupplier<
          'openrouter',
          BrainSuppliesOpenRouter
        >('openrouter', {
          creds: async () => {
            getterCallCount += 1;
            return { OPENROUTER_API_KEY: realApiKey };
          },
        });

        const atom = genBrainAtom({ slug: 'openrouter/deepseek/flash' });
        const result = await atom.ask(
          {
            role: {},
            prompt: 'reply with exactly: "hello from context"',
            schema: { output: z.object({ message: z.string() }) },
          },
          context,
        );

        expect(getterCallCount).toBeGreaterThan(0);
        expect(result.output).not.toBeNull();
      });
    });
  });

  given('[case2] getter called fresh per ask', () => {
    when('[t0] ask is called multiple times', () => {
      then('getter is invoked each time', async () => {
        let getterCallCount = 0;

        const context = genContextBrainSupplier<
          'openrouter',
          BrainSuppliesOpenRouter
        >('openrouter', {
          creds: async () => {
            getterCallCount += 1;
            return { OPENROUTER_API_KEY: realApiKey };
          },
        });

        const atom = genBrainAtom({ slug: 'openrouter/deepseek/flash' });

        // first ask
        await atom.ask(
          {
            role: {},
            prompt: 'reply: "first"',
            schema: { output: z.object({ message: z.string() }) },
          },
          context,
        );
        const countAfterFirst = getterCallCount;

        // second ask
        await atom.ask(
          {
            role: {},
            prompt: 'reply: "second"',
            schema: { output: z.object({ message: z.string() }) },
          },
          context,
        );
        const countAfterSecond = getterCallCount;

        expect(countAfterFirst).toEqual(1);
        expect(countAfterSecond).toEqual(2);
      });
    });
  });

  given('[case3] getter error propagation', () => {
    when('[t0] creds getter throws', () => {
      then('error propagates with message', async () => {
        const context = genContextBrainSupplier<
          'openrouter',
          BrainSuppliesOpenRouter
        >('openrouter', {
          creds: async () => {
            throw new Error('vault unreachable');
          },
        });

        const atom = genBrainAtom({ slug: 'openrouter/deepseek/flash' });
        const error = await getError(
          atom.ask(
            {
              role: {},
              prompt: 'hello',
              schema: { output: z.object({ message: z.string() }) },
            },
            context,
          ),
        );

        expect(error).toBeDefined();
        expect(error.message).toContain('vault unreachable');
      });
    });
  });

  given('[case4] multi-tenant isolation', () => {
    when('[t0] different contexts with different getters', () => {
      then('each call uses its own context creds', async () => {
        // track which api key was used per call
        const apiKeysUsed: string[] = [];

        const contextA = genContextBrainSupplier<
          'openrouter',
          BrainSuppliesOpenRouter
        >('openrouter', {
          creds: async () => {
            apiKeysUsed.push('keyA');
            return { OPENROUTER_API_KEY: realApiKey }; // same key for api call to succeed
          },
        });

        const contextB = genContextBrainSupplier<
          'openrouter',
          BrainSuppliesOpenRouter
        >('openrouter', {
          creds: async () => {
            apiKeysUsed.push('keyB');
            return { OPENROUTER_API_KEY: realApiKey }; // same key for api call to succeed
          },
        });

        const atom = genBrainAtom({ slug: 'openrouter/deepseek/flash' });

        // call with context A
        await atom.ask(
          {
            role: {},
            prompt: 'reply: "a"',
            schema: { output: z.object({ message: z.string() }) },
          },
          contextA,
        );

        // call with context B
        await atom.ask(
          {
            role: {},
            prompt: 'reply: "b"',
            schema: { output: z.object({ message: z.string() }) },
          },
          contextB,
        );

        expect(apiKeysUsed).toEqual(['keyA', 'keyB']);
      });
    });
  });

  given('[case5] keyrack shorthand pattern', () => {
    when('[t0] context uses keyrack config', () => {
      then('credentials are fetched from keyrack', async () => {
        const context = genContextBrainSupplier<
          'openrouter',
          BrainSuppliesOpenRouter
        >('openrouter', {
          creds: { keyrack: { owner: 'ehmpath', env: 'test' } },
        });

        const atom = genBrainAtom({ slug: 'openrouter/deepseek/flash' });
        const result = await atom.ask(
          {
            role: {},
            prompt: 'reply with exactly: "hello from keyrack"',
            schema: { output: z.object({ message: z.string() }) },
          },
          context,
        );

        // if we get here without error, keyrack shorthand worked
        expect(result.output).not.toBeNull();
      });
    });
  });
});
