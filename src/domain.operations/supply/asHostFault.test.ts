import OpenAI from 'openai';

import { HostFaultError } from '../../domain.objects/HostFaultError';
import { asHostFault } from './asHostFault';

/**
 * .what = a reply with one choice, as openrouter returns it
 */
const genReply = (input: {
  finishReason: string | null;
  content: string;
}): OpenAI.ChatCompletion =>
  ({
    id: 'gen-1',
    choices: [
      {
        index: 0,
        finish_reason: input.finishReason,
        message: { role: 'assistant', content: input.content },
      },
    ],
  }) as unknown as OpenAI.ChatCompletion; // .note = openrouter's 'error' finish reason is absent from the sdk's union. removal: when the sdk's union includes it

/**
 * .what = the body openrouter returned on 2026-10-21, captured live
 * .why = every 1.vision peer reviewer of three crews died on this exact 400;
 *        the clamp holds its real shape, not a guess at it
 */
const BODY_HOST_400_CAPTURED = {
  message: 'Provider returned error',
  code: 400,
  metadata: {
    raw: '{"error":{"message":"Request could not be processed","type":"invalid_request_error"}}',
    provider_name: 'OpenInference',
    is_byok: false,
  },
};

const genApiError = (input: { status: number; body: object | undefined }) =>
  new OpenAI.APIError(input.status, input.body, undefined, new Headers());

const TEST_CASES: {
  description: string;
  given: Parameters<typeof asHostFault>[0];
  expect: { output: ReturnType<typeof asHostFault> };
}[] = [
  {
    description:
      'a host 400, as captured live, is a failed host that names itself',
    given: {
      error: genApiError({ status: 400, body: BODY_HOST_400_CAPTURED }),
    },
    expect: {
      output: {
        outcome: 'failed',
        providerName: 'OpenInference',
        isHostMarked: true,
      },
    },
  },
  {
    description: 'a 400 with the provider marker and no name is still the host',
    given: {
      error: genApiError({
        status: 400,
        body: { message: 'Provider returned error', code: 400 },
      }),
    },
    expect: {
      output: { outcome: 'failed', providerName: null, isHostMarked: true },
    },
  },
  {
    description: 'a 400 with a name and no marker is still the host',
    given: {
      error: genApiError({
        status: 400,
        body: {
          message: 'Request could not be processed',
          code: 400,
          metadata: { provider_name: 'OpenInference' },
        },
      }),
    },
    expect: {
      output: {
        outcome: 'failed',
        providerName: 'OpenInference',
        isHostMarked: true,
      },
    },
  },
  {
    description: "a 400 with neither marker nor name is the caller's own fault",
    given: {
      error: genApiError({
        status: 400,
        body: { message: 'messages: field required', code: 400 },
      }),
    },
    expect: { output: null },
  },
  {
    description: "a 400 with no body is the caller's own fault",
    given: { error: genApiError({ status: 400, body: undefined }) },
    expect: { output: null },
  },
  {
    description: 'a 429 that names its host is throttled, with the name',
    given: {
      error: genApiError({
        status: 429,
        body: {
          message: 'Provider returned error',
          code: 429,
          metadata: { provider_name: 'Chutes' },
        },
      }),
    },
    expect: {
      output: {
        outcome: 'throttled',
        providerName: 'Chutes',
        isHostMarked: true,
      },
    },
  },
  {
    // .why = #21's own message: a host's 429, marked, which may name no host.
    //        it is a host's fault, so the admitted set walks it (F8)
    description:
      'a 429 with the provider marker and no name is a marked throttle',
    given: {
      error: genApiError({
        status: 429,
        body: { message: 'Provider returned error', code: 429 },
      }),
    },
    expect: {
      output: { outcome: 'throttled', providerName: null, isHostMarked: true },
    },
  },
  {
    // .why = the 429 shape openrouter's errors doc shows (2026-10-21): a
    //        normalized `error_type`, no `provider_name`, no marker. openrouter's
    //        own limit: the admitted set rethrows it in one send (c9, F8)
    description:
      "a 429 in openrouter's documented normalized shape is throttled, with no name",
    given: {
      error: genApiError({
        status: 429,
        body: {
          code: 429,
          message: 'Rate limit exceeded',
          metadata: {
            error_type: 'rate_limit_exceeded',
            provider_code: 'rate_limited',
          },
        },
      }),
    },
    expect: {
      output: { outcome: 'throttled', providerName: null, isHostMarked: false },
    },
  },
  {
    description: 'a 429 with no name is throttled, with no name',
    given: { error: genApiError({ status: 429, body: undefined }) },
    expect: {
      output: { outcome: 'throttled', providerName: null, isHostMarked: false },
    },
  },
  {
    description: 'a 404 is refused',
    given: { error: genApiError({ status: 404, body: undefined }) },
    expect: {
      output: { outcome: 'refused', providerName: null, isHostMarked: false },
    },
  },
  {
    description: 'a 500 is not a host fault',
    given: {
      error: genApiError({ status: 500, body: BODY_HOST_400_CAPTURED }),
    },
    expect: { output: null },
  },
  {
    description: 'a 401 is not a host fault',
    given: { error: genApiError({ status: 401, body: undefined }) },
    expect: { output: null },
  },
  {
    description: 'a plain error is not a host fault',
    given: { error: new Error('socket hang up') },
    expect: { output: null },
  },
  {
    description: 'a blank provider name reads as no name',
    given: {
      error: genApiError({
        status: 429,
        body: { metadata: { provider_name: '  ' } },
      }),
    },
    expect: {
      output: { outcome: 'throttled', providerName: null, isHostMarked: false },
    },
  },
  {
    description: 'a 502 is failed (issue #12)',
    given: { error: genApiError({ status: 502, body: undefined }) },
    expect: {
      output: { outcome: 'failed', providerName: null, isHostMarked: false },
    },
  },
  {
    description: 'a 503 is failed',
    given: { error: genApiError({ status: 503, body: undefined }) },
    expect: {
      output: { outcome: 'failed', providerName: null, isHostMarked: false },
    },
  },
  {
    description:
      'a 504 that names its host is failed, with the name (issue #12)',
    given: {
      error: genApiError({
        status: 504,
        body: {
          message: 'Provider returned error',
          code: 504,
          metadata: { provider_name: 'Chutes' },
        },
      }),
    },
    expect: {
      output: { outcome: 'failed', providerName: 'Chutes', isHostMarked: true },
    },
  },
  {
    description: 'a cut body is body-cut, marked to no host',
    given: {
      error: new HostFaultError({
        fault: 'body-cut',
        tags: ['a'],
        bound: { milliseconds: 1 },
      }),
    },
    expect: {
      output: { outcome: 'body-cut', providerName: null, isHostMarked: false },
    },
  },
  {
    description: 'a stall is stalled, marked to no host',
    given: {
      error: new HostFaultError({
        fault: 'stalled',
        tags: ['a'],
        bound: { milliseconds: 1 },
      }),
    },
    expect: {
      output: { outcome: 'stalled', providerName: null, isHostMarked: false },
    },
  },
  {
    description: 'a whole json reply is no host fault',
    given: {
      response: genReply({ finishReason: 'stop', content: '{"a":1}' }),
      expectsJson: true,
    },
    expect: { output: null },
  },
  {
    description: 'prose where json was owed is prose',
    given: {
      response: genReply({ finishReason: 'stop', content: 'sure!' }),
      expectsJson: true,
    },
    expect: {
      output: { outcome: 'prose', providerName: null, isHostMarked: true },
    },
  },
  {
    description: 'stop with 0 chars where json was owed is empty (issue #24)',
    given: {
      response: genReply({ finishReason: 'stop', content: '' }),
      expectsJson: true,
    },
    expect: {
      output: { outcome: 'empty', providerName: null, isHostMarked: true },
    },
  },
  {
    description: 'stop with 0 chars on a plain ask is no host fault',
    given: {
      response: genReply({ finishReason: 'stop', content: '' }),
      expectsJson: false,
    },
    expect: { output: null },
  },
  {
    description: 'a reply that ended in error is failed',
    given: {
      response: genReply({ finishReason: 'error', content: '' }),
      expectsJson: false,
    },
    expect: {
      output: { outcome: 'failed', providerName: null, isHostMarked: true },
    },
  },
  {
    description: 'a reply cut at the output limit is never a host fault',
    given: {
      response: genReply({ finishReason: 'length', content: '' }),
      expectsJson: true,
    },
    expect: { output: null },
  },
];

describe('asHostFault', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asHostFault(thisCase.given)).toEqual(thisCase.expect.output);
    }),
  );
});
