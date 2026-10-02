import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { asSupplyFilters } from '../supply/asSupplyFilters';
import { asAtomTarget } from './asAtomTarget';
import { SPEC_ESTIMATE_BY_TIER } from './BrainAtom.config';
import { SPEC_ESTIMATE_UNLISTED } from './slug/AtomSlug.unlisted';

describe('asAtomTarget', () => {
  given('[case1] a tier slug', () => {
    when('[t0] a bare tier with filters is cast', () => {
      const target = asAtomTarget({
        slug: 'openrouter/deepseek/flash/floor&speed=min50tps',
      });

      // .why = no model id lives in this package; the tier's model is read
      //        from openrouter's catalog at ask (`getOneTierModel`)
      then('it names the tier, its estimate spec, and no model', () => {
        expect(target.tier).toEqual('openrouter/deepseek/flash');
        expect(target.model).toEqual(null);
        expect(target.spec).toEqual(SPEC_ESTIMATE_BY_TIER.flash);
        expect(target.description).toContain('estimate');
      });

      then('the filters and their raw segment are kept', () => {
        expect(target.filters?.floor).toEqual(true);
        expect(target.filters?.speedMinTps).toEqual(50);
        expect(target.filterSuffix).toEqual('/floor&speed=min50tps');
      });
    });

    // 🔴 .why = a tier name must win over the unlisted read of the same
    //           shape, or the tier `deepseek/flash` would be sent as an id
    when('[t1] a bare tier with no filters is cast', () => {
      then('it is the tier, never an unlisted id', () => {
        const target = asAtomTarget({ slug: 'openrouter/deepseek/flash' });
        expect(target.tier).toEqual('openrouter/deepseek/flash');
        expect(target.model).toEqual(null);
      });
    });

    when('[t2] each pro and flash tier is cast', () => {
      then('each carries the estimate of its own tier', () => {
        expect(asAtomTarget({ slug: 'openrouter/z-ai/pro' }).spec).toEqual(
          SPEC_ESTIMATE_BY_TIER.pro,
        );
        expect(asAtomTarget({ slug: 'openrouter/z-ai/flash' }).spec).toEqual(
          SPEC_ESTIMATE_BY_TIER.flash,
        );
      });
    });
  });

  given('[case2] an unlisted openrouter id (case=20)', () => {
    when('[t0] it is cast with filters', () => {
      const target = asAtomTarget({
        slug: 'openrouter/acme/new-model/floor&privacy=full',
      });

      then('the id is openrouter id verbatim', () => {
        expect(target.model).toEqual('acme/new-model');
      });

      then('it names no tier, and carries the labelled estimate spec', () => {
        expect(target.tier).toEqual(null);
        expect(target.spec).toEqual(SPEC_ESTIMATE_UNLISTED);
        expect(target.description).toContain('estimate');
      });

      then('the filters parse', () => {
        expect(target.filters?.floor).toEqual(true);
        expect(target.filters?.privacy).toEqual('full');
        expect(target.filterSuffix).toEqual('/floor&privacy=full');
      });
    });

    // 🔴 .why = wisher ruled 2026-10-02 (F31): by default the supply is our
    //           choice, never openrouter's balancer
    when('[t1] it is cast with no filters', () => {
      then(
        'it takes the default supply filters: floor, ≥ 50 tps, full privacy',
        () => {
          const target = asAtomTarget({ slug: 'openrouter/acme/new-model' });
          expect(target.model).toEqual('acme/new-model');
          expect(target.filters).toEqual(
            asSupplyFilters({ segment: 'floor&speed=min50tps&privacy=full' }),
          );
          expect(target.filterSuffix).toEqual('');
        },
      );
    });

    when('[t2] it is cast with filters of its own', () => {
      then('those replace the default whole, never merge', () => {
        const target = asAtomTarget({
          slug: 'openrouter/acme/new-model/region=usa',
        });
        expect(target.filters).toEqual(
          asSupplyFilters({ segment: 'region=usa' }),
        );
        expect(target.filters.floor).toEqual(false);
        expect(target.filters.privacy).toEqual(null);
      });
    });
  });

  given('[case3] a slug that names no model', () => {
    when('[t0] the literal pattern is named', () => {
      then('it is refused at parse, and names the shape to fill', async () => {
        const error = await getError(() =>
          asAtomTarget({ slug: 'openrouter/*/*/*' }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('openrouter/{author}/{model}');
        expect(error.message).toMatchSnapshot();
      });
    });

    when('[t1] a slug of the wrong shape is named', () => {
      const TEST_CASES = [
        'invalid/slug',
        'openrouter/acme',
        'anthropic/acme/model',
      ];

      then(
        'each is refused, and names both forms that would work',
        async () => {
          for (const slug of TEST_CASES) {
            const error = await getError(() => asAtomTarget({ slug }));
            expect(error).toBeInstanceOf(ConstraintError);
            expect(error.message).toContain('a tier');
            expect(error.message).toContain('any openrouter id');
            expect(error.message).toMatchSnapshot();
          }
        },
      );
    });
  });
});
