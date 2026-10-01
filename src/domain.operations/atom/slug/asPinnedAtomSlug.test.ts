import { given, then, when } from 'test-fns';

import { CONFIG_BY_ATOM_SLUG } from '../BrainAtom.config';
import {
  type BrainAtomSlugFireworksLatest,
  type BrainAtomSlugFireworksLatestBare,
  LATEST_BY_BARE_SLUG,
  PINNED_BY_LATEST_SLUG,
} from './AtomSlug.latest';
import {
  type BrainAtomSlugFireworksLegacy,
  PINNED_BY_LEGACY_SLUG,
} from './AtomSlug.legacy';
import {
  type BrainAtomSlugFireworksRetired,
  isRetiredAtomSlug,
  RETIREMENT_BY_ATOM_SLUG,
} from './AtomSlug.retired';
import { asPinnedAtomSlug } from './asPinnedAtomSlug';

describe('asPinnedAtomSlug', () => {
  given('[case1] a retired slug with one named successor', () => {
    when('[t0] deepseek v4-flash is resolved', () => {
      then('it lands on v4.1-flash', () => {
        expect(
          asPinnedAtomSlug({ slug: 'fireworks/deepseek/flash/v4' }),
        ).toEqual('fireworks/deepseek/flash/v4.1');
      });
    });

    when('[t1] glm 5.2 is resolved', () => {
      then('it lands on 5.3', () => {
        expect(asPinnedAtomSlug({ slug: 'fireworks/glm/pro/5.2' })).toEqual(
          'fireworks/glm/pro/5.3',
        );
      });
    });
  });

  given('[case2] a retired slug with no single successor', () => {
    // .why = the probe on 2026-09-22 found every retired id still serves. to
    //        re-aim or throw here would break a caller whose model works, so
    //        the slug must come back unchanged. the named error is raised at
    //        the call site instead, once the id actually 404s.
    const ambiguous: BrainAtomSlugFireworksRetired[] = [
      'fireworks/deepseek/pro/v4',
      'fireworks/kimi/pro/k2.6',
      'fireworks/kimi/code/k2.7',
    ];

    when('[t0] each is resolved', () => {
      then('it returns unchanged, never guessed at', () => {
        for (const slug of ambiguous) {
          expect(asPinnedAtomSlug({ slug })).toEqual(slug);
        }
      });

      then('each is declared AMBIGUOUS rather than routed', () => {
        for (const slug of ambiguous) {
          expect(RETIREMENT_BY_ATOM_SLUG[slug].kind).toEqual('AMBIGUOUS');
        }
      });
    });
  });

  given('[case3] a versionless generic slug', () => {
    when('[t0] the deepseek flash generic is resolved', () => {
      then('it lands on the current flash version', () => {
        expect(
          asPinnedAtomSlug({ slug: 'fireworks/deepseek/flash/latest' }),
        ).toEqual('fireworks/deepseek/flash/v4.1');
      });
    });

    when('[t1] every generic is resolved', () => {
      then('each lands on a slug that has a config', () => {
        const generics = Object.keys(
          PINNED_BY_LATEST_SLUG,
        ) as BrainAtomSlugFireworksLatest[];
        for (const slug of generics) {
          expect(CONFIG_BY_ATOM_SLUG[asPinnedAtomSlug({ slug })]).toBeDefined();
        }
      });

      then('the generic set is not empty', () => {
        // .why = guards the guard — an empty registry would pass the assertion
        //        above vacuously.
        expect(Object.keys(PINNED_BY_LATEST_SLUG).length).toBeGreaterThan(0);
      });

      // 🔴 .why = a generic exists so a consumer never feels a retirement. one
      //           that lands on a retired model is a scheduled break under a
      //           safe name — it fails the day the provider withdraws that
      //           model, for every caller who took the generic to be safe.
      then('none lands on a model that is itself retired', () => {
        const generics = Object.keys(
          PINNED_BY_LATEST_SLUG,
        ) as BrainAtomSlugFireworksLatest[];
        const doomed = generics.filter((slug) =>
          isRetiredAtomSlug(asPinnedAtomSlug({ slug })),
        );
        expect(doomed).toEqual([]);
      });
    });
  });

  given('[case3b] a bare versionless slug', () => {
    when('[t0] the bare deepseek flash slug is resolved', () => {
      then('it lands where its /latest twin lands', () => {
        expect(asPinnedAtomSlug({ slug: 'fireworks/deepseek/flash' })).toEqual(
          asPinnedAtomSlug({ slug: 'fireworks/deepseek/flash/latest' }),
        );
      });
    });

    when('[t1] every bare slug is read', () => {
      const bares = Object.keys(
        LATEST_BY_BARE_SLUG,
      ) as BrainAtomSlugFireworksLatestBare[];

      then('each names exactly `${bare}/latest`', () => {
        // .why = a bare slug is shorthand, never a second generic. a row that
        //        pointed anywhere else would be a generic that disagrees with
        //        its own longhand.
        for (const bare of bares) {
          expect(LATEST_BY_BARE_SLUG[bare]).toEqual(`${bare}/latest`);
        }
      });

      then('there is one bare slug per /latest slug', () => {
        expect(bares.length).toEqual(Object.keys(PINNED_BY_LATEST_SLUG).length);
        expect(bares.length).toBeGreaterThan(0);
      });
    });
  });

  given('[case4] the cross-tier deepseek pro generic', () => {
    // .why = deepseek publishes no un-retired pro-tier model, and fireworks
    //        named v4.1-flash as v4-pro's successor. so the pro generic points
    //        at a CHEAPFAST model, deliberately.
    when('[t0] the deepseek pro generic is resolved', () => {
      then('it lands on the successor fireworks named', () => {
        expect(
          asPinnedAtomSlug({ slug: 'fireworks/deepseek/pro/latest' }),
        ).toEqual('fireworks/deepseek/flash/v4.1');
      });
    });

    // 🔴 .why = the generic delegates the choice; the PIN does not. this pair
    //           is the whole distinction, so it is clamped rather than left to
    //           a comment. if someone ever routes the pinned slug too, a
    //           frontier caller silently drops a tier — the exact harm refused
    //           when this table was built.
    when('[t1] the pinned v4-pro slug is resolved', () => {
      then('it does NOT follow the generic, and stands unchanged', () => {
        expect(asPinnedAtomSlug({ slug: 'fireworks/deepseek/pro/v4' })).toEqual(
          'fireworks/deepseek/pro/v4',
        );
      });
    });
  });

  given('[case5] a pinned slug with no retirement', () => {
    when('[t0] it is resolved', () => {
      then('it returns itself untouched', () => {
        expect(asPinnedAtomSlug({ slug: 'fireworks/kimi/pro/k3' })).toEqual(
          'fireworks/kimi/pro/k3',
        );
      });
    });
  });

  given('[case6] a legacy pre-tier slug', () => {
    // 🔴 .why = the tier segment was added to the slug shape AFTER consumers
    //           had already named the old forms. every old name must still
    //           reach a live model, or the rename IS the churn this package
    //           exists to absorb.
    when('[t0] an old name is cast', () => {
      then('it lands on its tiered twin', () => {
        expect(asPinnedAtomSlug({ slug: 'fireworks/kimi/k2.7-code' })).toEqual(
          'fireworks/kimi/code/k2.7',
        );
      });
    });

    when('[t1] an old name whose twin is retired is cast', () => {
      then('it follows the retirement route too', () => {
        // .why = two hops: legacy -> pinned -> routed successor. a caller on
        //        the oldest name still lands on a model that serves.
        expect(
          asPinnedAtomSlug({ slug: 'fireworks/deepseek/v4-flash' }),
        ).toEqual('fireworks/deepseek/flash/v4.1');
      });
    });

    when('[t2] every legacy name is cast', () => {
      const legacies = Object.keys(
        PINNED_BY_LEGACY_SLUG,
      ) as BrainAtomSlugFireworksLegacy[];

      then('each lands on a slug that has a config', () => {
        for (const slug of legacies) {
          expect(CONFIG_BY_ATOM_SLUG[asPinnedAtomSlug({ slug })]).toBeDefined();
        }
      });

      then('the legacy set covers every pinned slug', () => {
        // .why = guards the guard, and holds the rename total: a pinned slug
        //        with no old name means one was dropped in the rename.
        expect(legacies.length).toEqual(
          Object.keys(CONFIG_BY_ATOM_SLUG).length,
        );
      });
    });
  });

  given('[case7] the registries as a whole', () => {
    when('[t0] every retirement route is followed', () => {
      then('each ROUTED successor has a config', () => {
        // .why = a route onto a slug with no config would resolve to a model
        //        that cannot be built — a silent dead end for every caller on
        //        that slug.
        for (const retirement of Object.values(RETIREMENT_BY_ATOM_SLUG)) {
          if (retirement.kind !== 'ROUTED') continue;
          expect(CONFIG_BY_ATOM_SLUG[retirement.into]).toBeDefined();
        }
      });

      then('each AMBIGUOUS candidate has a config', () => {
        // .why = the error names these to the caller, so a candidate that
        //        cannot be built would send them somewhere broken.
        for (const retirement of Object.values(RETIREMENT_BY_ATOM_SLUG)) {
          if (retirement.kind !== 'AMBIGUOUS') continue;
          for (const candidate of retirement.among) {
            expect(CONFIG_BY_ATOM_SLUG[candidate]).toBeDefined();
          }
        }
      });

      then('no ROUTED successor is itself ambiguous', () => {
        // .why = to route a caller onto a model that is itself retired with no
        //        successor would move the dead end rather than remove it.
        for (const retirement of Object.values(RETIREMENT_BY_ATOM_SLUG)) {
          if (retirement.kind !== 'ROUTED') continue;
          expect(asPinnedAtomSlug({ slug: retirement.into })).toEqual(
            retirement.into,
          );
        }
      });
    });
  });
});
