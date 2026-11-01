import { MalfunctionError } from 'helpful-errors';
import OpenAI from 'openai';

import type { FloorAttempt } from '../../domain.objects/FloorAttempt';
import { getOneFloorExhaustedError } from './getOneFloorExhaustedError';

const ATTEMPTS: FloorAttempt[] = [
  { tag: 'cheap/fp8', outcome: 'throttled' },
  { tag: 'mid/fp8', outcome: 'refused' },
  { tag: 'dear/bf16', outcome: 'failed' },
];

const REASON_CONTEXT =
  "This endpoint's maximum context length is 163840 tokens. However, you requested about 201234 tokens.";

const genHostError = (input: { status: number; raw: string }) =>
  new OpenAI.APIError(
    input.status,
    {
      message: 'Provider returned error',
      code: input.status,
      metadata: { raw: input.raw, provider_name: 'Dear' },
    },
    undefined,
    new Headers(),
  );

/**
 * .why = the fix line has the forms a caller reads: with openrouter's
 *        retry-after, without it, after a host 400 whose reason may name the
 *        request, and after a throttle whose reason never does. each is snapped,
 *        so drift in any shows
 */
const TEST_CASES: {
  description: string;
  given: { retryAfter: string | null; faultLast: Error | null };
  expect: { fix: string; reason: string | null };
}[] = [
  {
    description: 'a walk with a throttle names the wait openrouter asked for',
    given: { retryAfter: '7', faultLast: null },
    expect: {
      fix: "fix: retry after 7s (openrouter's retry-after)",
      reason: null,
    },
  },
  {
    description: 'a walk with no throttle says to retry later',
    given: { retryAfter: null, faultLast: null },
    expect: { fix: 'fix: retry later, or loosen a promise', reason: null },
  },
  {
    description:
      "a walk whose last host 400 named the caller's request shows that reason, and says to fix the request",
    given: {
      retryAfter: '7',
      faultLast: genHostError({
        status: 400,
        raw: JSON.stringify({ error: { message: REASON_CONTEXT } }),
      }),
    },
    expect: {
      fix: 'fix: if the last host fault names your request (e.g. a context limit), fix the request; else retry after 7s',
      reason: REASON_CONTEXT,
    },
  },
  {
    description:
      'a walk with no throttle whose last host 400 named the request says to fix it, else retry later',
    given: {
      retryAfter: null,
      faultLast: genHostError({
        status: 400,
        raw: JSON.stringify({ error: { message: REASON_CONTEXT } }),
      }),
    },
    expect: {
      fix: 'fix: if the last host fault names your request (e.g. a context limit), fix the request; else retry later, or loosen a promise',
      reason: REASON_CONTEXT,
    },
  },
  {
    description:
      'a walk whose last host throttled shows its reason, and never blames the request',
    given: {
      retryAfter: '7',
      faultLast: genHostError({ status: 429, raw: 'rate limited upstream' }),
    },
    expect: {
      fix: "fix: retry after 7s (openrouter's retry-after)",
      reason: 'rate limited upstream',
    },
  },
];

describe('getOneFloorExhaustedError', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const error = getOneFloorExhaustedError({
        model: 'deepseek/deepseek-v4.1-flash',
        attempts: ATTEMPTS,
        retryAfter: thisCase.given.retryAfter,
        faultLast: thisCase.given.faultLast,
        untried: 0,
        bound: { minutes: 10 },
      });
      expect(error).toBeInstanceOf(MalfunctionError);
      expect(error.message).toContain(thisCase.expect.fix);
      if (!thisCase.expect.fix.includes('fix the request'))
        expect(error.message).not.toContain('fix the request');
      if (thisCase.expect.reason)
        expect(error.message).toContain(
          `last host fault: ${thisCase.expect.reason}`,
        );
      if (!thisCase.expect.reason)
        expect(error.message).not.toContain('last host fault');
      const cause = 'cause' in error ? error.cause : undefined;
      expect(cause ?? null).toBe(thisCase.given.faultLast); // the host's own error rides as cause
      expect(error.message).toMatchSnapshot();
    }),
  );

  // .why = a walk that stopped on stalls names how many it waited out and left untried
  test('a walk stopped on stalls names the stalls and the hosts left untried', () => {
    const error = getOneFloorExhaustedError({
      model: 'deepseek/deepseek-v4.1-flash',
      attempts: [
        { tag: 'cheap/fp8', outcome: 'stalled' },
        { tag: 'mid/fp8', outcome: 'stalled' },
      ],
      retryAfter: null,
      faultLast: null,
      untried: 3,
      bound: { minutes: 10 },
    });
    expect(error.message).toContain(
      'the walk stopped after 2 stalled hosts, with 3 untried',
    );
    expect(error.message).toMatchSnapshot();
  });

  // .why = case=9: a stall names the bound, and names a thought cap as the lever for a slow answer
  test('a walk with a stall names the bound and the thought cap', () => {
    const error = getOneFloorExhaustedError({
      model: 'deepseek/deepseek-v4.1-flash',
      attempts: [{ tag: 'cheap/fp8', outcome: 'stalled' }],
      retryAfter: null,
      faultLast: null,
      untried: 0,
      bound: { minutes: 10 },
    });
    expect(error.message).toContain('inside 10m');
    expect(error.message).toContain('cap thought (effort on the ask)');
  });

  test('a walk with no stall names no thought cap', () => {
    const error = getOneFloorExhaustedError({
      model: 'deepseek/deepseek-v4.1-flash',
      attempts: ATTEMPTS,
      retryAfter: null,
      faultLast: null,
      untried: 0,
      bound: { minutes: 10 },
    });
    expect(error.message).not.toContain('cap thought');
  });
});
