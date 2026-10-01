import { given, then, when } from 'test-fns';

import { getOneRetirementError } from './getOneRetirementError';

/**
 * .what = the error fireworks returns once it withdraws a model
 * .why = the exact text the openai client surfaces, so the match is tested
 *        against the real shape rather than an invented one
 */
const errorModelAbsent = new Error(
  '404 Model not found, inaccessible, and/or not deployed',
);

describe('getOneRetirementError', () => {
  given('[case1] an ambiguous retired slug that 404s', () => {
    when('[t0] the error is read', () => {
      const built = getOneRetirementError({
        slug: 'fireworks/kimi/pro/k2.6',
        error: errorModelAbsent,
      });

      then('an error is built', () => {
        expect(built).not.toEqual(null);
      });

      then('it names every candidate successor', () => {
        // .why = "fail loud and name the choice" — an error that says only
        //        "retired" leaves the caller exactly as stuck as the raw 404.
        expect(built?.message).toContain('fireworks/glm/pro/5.3');
        expect(built?.message).toContain('fireworks/kimi/pro/k3');
      });

      then('it names the slug that died', () => {
        expect(built?.message).toContain('fireworks/kimi/pro/k2.6');
      });

      then('it points at the versionless slug as the durable fix', () => {
        expect(built?.message).toContain('/latest');
      });

      then('it preserves the provider error as the cause', () => {
        // .why = the raw 404 is what an on-call engineer greps for. helpful-errors
        //        links it as `cause` rather than inline it, so the stacktrace
        //        trail of both errors stays visible.
        // .note = asserted by property path, not by `built.cause` — `Error.cause`
        //         is es2022 and this package targets es2020, so it is absent
        //         from the type while present at runtime.
        expect(built).toHaveProperty('cause', errorModelAbsent);
      });

      then('it carries the reason no route was taken', () => {
        // .why = "why did this not just work?" is the caller's first question,
        //        and the answer decides which successor they pick.
        expect(built?.message).toContain('why no automatic route');
      });
    });
  });

  given('[case2] a routed retired slug', () => {
    // .why = a routed slug never reaches the api under its old name, because
    //        the resolver re-aims it first. so it must build no error.
    when('[t0] the error is read', () => {
      then('no error is built', () => {
        expect(
          getOneRetirementError({
            slug: 'fireworks/deepseek/flash/v4',
            error: errorModelAbsent,
          }),
        ).toEqual(null);
      });
    });
  });

  given('[case3] a slug with no retirement', () => {
    when('[t0] the error is read', () => {
      then('no error is built', () => {
        expect(
          getOneRetirementError({
            slug: 'fireworks/kimi/pro/k3',
            error: errorModelAbsent,
          }),
        ).toEqual(null);
      });
    });
  });

  given('[case4] an ambiguous slug that fails for an unrelated reason', () => {
    // .why = the interceptor must never repaint an unrelated failure as a
    //        retirement. a rate limit is not a withdrawn model, and to report
    //        it as one would send the caller to fix the wrong cause.
    when('[t0] a rate limit error is read', () => {
      then('no error is built, so the original rethrows untouched', () => {
        expect(
          getOneRetirementError({
            slug: 'fireworks/kimi/pro/k2.6',
            error: new Error('429 rate limit exceeded'),
          }),
        ).toEqual(null);
      });
    });

    when('[t1] an auth error is read', () => {
      then('no error is built', () => {
        expect(
          getOneRetirementError({
            slug: 'fireworks/kimi/pro/k2.6',
            error: new Error('401 unauthorized'),
          }),
        ).toEqual(null);
      });
    });
  });
});
