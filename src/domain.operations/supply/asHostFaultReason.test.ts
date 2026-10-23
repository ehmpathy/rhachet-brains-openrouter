import OpenAI from 'openai';

import { asHostFaultReason } from './asHostFaultReason';

const genApiError = (input: { status: number; body: object | undefined }) =>
  new OpenAI.APIError(input.status, input.body, undefined, new Headers());

const TEST_CASES: {
  description: string;
  given: { error: unknown };
  expect: { output: string | null };
}[] = [
  {
    description: "the host's json reason, as captured live 2026-10-21",
    given: {
      error: genApiError({
        status: 400,
        body: {
          message: 'Provider returned error',
          code: 400,
          metadata: {
            raw: '{"error":{"message":"Request could not be processed","type":"invalid_request_error"}}',
            provider_name: 'OpenInference',
          },
        },
      }),
    },
    expect: { output: 'Request could not be processed' },
  },
  {
    description: "a caller's fault a host forwards, e.g. a context overflow",
    given: {
      error: genApiError({
        status: 400,
        body: {
          message: 'Provider returned error',
          code: 400,
          metadata: {
            raw: '{"error":{"message":"This endpoint\'s maximum context length is 163840 tokens. However, you requested about 201234 tokens."}}',
            provider_name: 'Chutes',
          },
        },
      }),
    },
    expect: {
      output:
        "This endpoint's maximum context length is 163840 tokens. However, you requested about 201234 tokens.",
    },
  },
  {
    description: 'a raw reason that is not json is read as text',
    given: {
      error: genApiError({
        status: 429,
        body: {
          message: 'Provider returned error',
          metadata: { raw: 'upstream rate limit', provider_name: 'Chutes' },
        },
      }),
    },
    expect: { output: 'upstream rate limit' },
  },
  {
    description: 'a raw json with no message holds no reason',
    given: {
      error: genApiError({
        status: 400,
        body: {
          message: 'Provider returned error',
          metadata: { raw: '{}', provider_name: 'Chutes' },
        },
      }),
    },
    expect: { output: null },
  },
  {
    description: 'a raw json with an empty error holds no reason',
    given: {
      error: genApiError({
        status: 400,
        body: {
          message: 'Provider returned error',
          metadata: { raw: '{"error":{}}', provider_name: 'Chutes' },
        },
      }),
    },
    expect: { output: null },
  },
  {
    description: 'no raw reason falls back to the body message',
    given: {
      error: genApiError({
        status: 429,
        body: { message: 'Rate limit exceeded', code: 429 },
      }),
    },
    expect: { output: 'Rate limit exceeded' },
  },
  {
    description: 'a long reason is cut to 300 chars',
    given: {
      error: genApiError({
        status: 400,
        body: { metadata: { raw: 'x'.repeat(500) } },
      }),
    },
    expect: { output: 'x'.repeat(300) },
  },
  {
    description: 'no body has no reason',
    given: { error: genApiError({ status: 404, body: undefined }) },
    expect: { output: null },
  },
  {
    description: 'a plain error has no host reason',
    given: { error: new Error('socket hang up') },
    expect: { output: null },
  },
];

describe('asHostFaultReason', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asHostFaultReason(thisCase.given)).toEqual(thisCase.expect.output);
    }),
  );
});
