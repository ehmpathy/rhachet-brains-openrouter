import OpenAI from 'openai';

import { asHostFault } from './asHostFault';

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
  given: { error: unknown };
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
];

describe('asHostFault', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asHostFault(thisCase.given)).toEqual(thisCase.expect.output);
    }),
  );
});
