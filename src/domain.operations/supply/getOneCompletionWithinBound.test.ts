import OpenAI from 'openai';
import { getError, given, then, useThen, when } from 'test-fns';

import { HostFaultError } from '../../domain.objects/HostFaultError';
import { getOneCompletionWithinBound } from './getOneCompletionWithinBound';

type Behavior =
  | 'serve'
  | 'bodyCut'
  | 'socketCut'
  | 'sdkTimeout'
  | 'stall'
  | 400;

/**
 * .what = a fake openai client whose one call answers per the declared behavior
 * .why = the bound's contract is how it names each transport fault; no network
 */
const genOpenAiFake = (input: { behavior: Behavior }) =>
  ({
    chat: {
      completions: {
        // .note = two positional args, as the sdk's `create(body, options)` takes them
        create: async (_: unknown, options: { signal: AbortSignal }) => {
          if (input.behavior === 'bodyCut')
            throw new SyntaxError('Unexpected end of JSON input');
          if (input.behavior === 'socketCut')
            throw Object.assign(new TypeError('terminated'), {
              cause: { code: 'UND_ERR_SOCKET' },
            });
          if (input.behavior === 'sdkTimeout')
            throw new OpenAI.APIConnectionTimeoutError();
          if (input.behavior === 'stall')
            return new Promise((_settle, reject) =>
              options.signal.addEventListener('abort', () =>
                reject(new OpenAI.APIUserAbortError()),
              ),
            );
          if (input.behavior === 400)
            throw new OpenAI.APIError(400, undefined, 'bad', new Headers());
          return { id: 'gen-1', choices: [] };
        },
      },
    },
  }) as unknown as OpenAI; // .note = a fake with only the one method the bound calls. removal: when the context declares that one method as its own structural type, the fake fits with no cast

const REQUEST = {
  model: 'deepseek/deepseek-v4.1-flash',
  messages: [{ role: 'user' as const, content: 'hi' }],
};

const runCall = (input: { behavior: Behavior }) =>
  getOneCompletionWithinBound(
    { request: REQUEST, tags: ['alpha', 'beta'], bound: { milliseconds: 50 } },
    { openai: genOpenAiFake(input) },
  );

describe('getOneCompletionWithinBound', () => {
  given('[case1] a host that serves inside the bound', () => {
    when('[t0] the call runs', () => {
      const scene = useThen('it returns', async () =>
        runCall({ behavior: 'serve' }),
      );
      then('the reply is returned untouched', () => {
        expect(scene.id).toEqual('gen-1');
      });
    });
  });

  given('[case2] a host whose body ends mid-json', () => {
    when('[t0] the call runs', () => {
      const scene = useThen('it fails loud', async () => {
        const error = await getError(runCall({ behavior: 'bodyCut' }));
        return {
          isFault: error instanceof HostFaultError,
          fault: error instanceof HostFaultError ? error.fault : null,
          message: error.message,
        };
      });
      then('it is a HostFaultError, never a raw SyntaxError', () => {
        expect(scene.isFault).toEqual(true);
        expect(scene.fault).toEqual('body-cut');
      });
      then('the message names the cut body and the hosts', () => {
        expect(scene.message).toContain('mid-json');
        expect(scene.message).toContain('alpha');
      });
      then('the message a caller reads matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  given('[case3] a host that sends no whole body inside the bound', () => {
    when('[t0] the call runs', () => {
      // .note = the fake rejects only when the bound aborts it, so a settle at all proves the bound fired
      const scene = useThen('it fails loud', async () => {
        const error = await getError(runCall({ behavior: 'stall' }));
        return {
          fault: error instanceof HostFaultError ? error.fault : null,
          message: error.message,
        };
      });
      then('it is a stall fault', () => {
        expect(scene.fault).toEqual('stalled');
      });
      then('the message names the bound', () => {
        expect(scene.message).toContain('50ms');
      });
      then('the message a caller reads matches snapshot', () => {
        expect(scene.message).toMatchSnapshot();
      });
    });
  });

  given('[case5] a host that drops the socket mid-body', () => {
    when('[t0] the call runs', () => {
      then('it is a body-cut fault, never a raw TypeError', async () => {
        const error = await getError(runCall({ behavior: 'socketCut' }));
        expect(error).toBeInstanceOf(HostFaultError);
        expect(error instanceof HostFaultError ? error.fault : null).toEqual(
          'body-cut',
        );
      });
    });
  });

  given('[case6] the sdk raises its own timeout', () => {
    when('[t0] the call runs', () => {
      then('it is a stall fault, never a raw timeout error', async () => {
        const error = await getError(runCall({ behavior: 'sdkTimeout' }));
        expect(error).toBeInstanceOf(HostFaultError);
        expect(error instanceof HostFaultError ? error.fault : null).toEqual(
          'stalled',
        );
      });
    });
  });

  given('[case4] a host that fails for another reason', () => {
    when('[t0] the call runs', () => {
      then('the error rethrows untouched', async () => {
        const error = await getError(runCall({ behavior: 400 }));
        expect(error).toBeInstanceOf(OpenAI.APIError);
        expect(error).not.toBeInstanceOf(HostFaultError);
      });
    });
  });
});
