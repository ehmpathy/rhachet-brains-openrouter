import { BrainAtom } from 'rhachet';
import { getError, given, then, when } from 'test-fns';

import { CONFIG_BY_ATOM_SLUG } from '../../domain.operations/atom/BrainAtom.config';
import { genBrainAtom } from '../../domain.operations/atom/genBrainAtom';
import {
  LATEST_BY_BARE_SLUG,
  PINNED_BY_LATEST_SLUG,
} from '../../domain.operations/atom/slug/AtomSlug.latest';
import { PINNED_BY_LEGACY_SLUG } from '../../domain.operations/atom/slug/AtomSlug.legacy';
import { asPinnedAtomSlug } from '../../domain.operations/atom/slug/asPinnedAtomSlug';
import { getBrainAtomsByFireworksAI } from './index';

describe('rhachet-brains-fireworksai.unit', () => {
  given('[case1] getBrainAtomsByFireworksAI', () => {
    when('[t0] called', () => {
      // .why = the count is DERIVED from the config, never hardcoded. a literal
      //        drifts the moment the catalog changes — this suite carried a
      //        `toHaveLength(10)` under a name that read "11 atoms", so the two
      //        had already disagreed.
      //
      // .note = the set owed is every accepted name — pinned, versionless,
      //         legacy, retired — each under its own name.
      then('exports every accepted name, under its own name', () => {
        const atoms = getBrainAtomsByFireworksAI();
        const slugs = atoms.map((a: BrainAtom) => a.slug);
        const owed = [
          ...Object.keys(CONFIG_BY_ATOM_SLUG),
          ...Object.keys(PINNED_BY_LATEST_SLUG),
          ...Object.keys(LATEST_BY_BARE_SLUG),
          ...Object.keys(PINNED_BY_LEGACY_SLUG),
        ];
        expect([...slugs].sort()).toEqual(owed.sort());
      });

      then('returns BrainAtom instances', () => {
        const atoms = getBrainAtomsByFireworksAI();

        // .why = the loop below verifies zero elements if the array is empty,
        //        so the case would pass while it proved naught
        expect(atoms.length).toBeGreaterThan(0);

        for (const atom of atoms) {
          expect(atom).toBeInstanceOf(BrainAtom);
        }
      });

      // .why = v4-flash was retired and routes to its successor, so the
      //        successor must be listed too: the slug a consumer holds must
      //        reach a listed model, which is the whole promise of the route.
      then(
        'lists the successor that fireworks/deepseek/flash/v4 routes to',
        () => {
          const atoms = getBrainAtomsByFireworksAI();
          const slugs = atoms.map((a: BrainAtom) => a.slug);
          expect(slugs).toContain(
            asPinnedAtomSlug({ slug: 'fireworks/deepseek/flash/v4' }),
          );
          expect(slugs).toContain('fireworks/deepseek/flash/v4.1');
        },
      );

      // 🔴 .why = a consumer that holds the retired name selects by it. so the
      //           retired name is listed under its OWN name, with the spec of
      //           the successor it routes to (`rule.require.redirected-slugs-selectable`).
      then(
        'lists the retired slug under its own name, as its successor',
        () => {
          const atoms = getBrainAtomsByFireworksAI();
          const atomRetired = atoms.find(
            (a: BrainAtom) => a.slug === 'fireworks/deepseek/flash/v4',
          );
          const atomSuccessor = atoms.find(
            (a: BrainAtom) => a.slug === 'fireworks/deepseek/flash/v4.1',
          );
          expect(atomRetired).toBeDefined();
          expect(atomRetired?.spec).toEqual(atomSuccessor?.spec);
        },
      );

      then('slugs match snapshot', () => {
        const atoms = getBrainAtomsByFireworksAI();
        const slugs = atoms.map((a: BrainAtom) => a.slug);
        expect(slugs[0]).toContain('fireworks/');
        expect(slugs).toMatchSnapshot();
      });

      then('specs match snapshot', () => {
        const atoms = getBrainAtomsByFireworksAI();
        const specs = atoms.map((a: BrainAtom) => ({
          slug: a.slug,
          spec: a.spec,
        }));
        expect(specs[0]).toHaveProperty('spec');
        expect(specs[0]).toHaveProperty('slug');
        expect(specs).toMatchSnapshot();
      });
    });
  });

  given('[case1b] CONFIG_BY_ATOM_SLUG model ids', () => {
    // .why = the account-qualified model id is closure-captured by genBrainAtom,
    //        so no BrainAtom snapshot can observe it. without this snapshot a
    //        retired or mistyped id reaches consumers unseen, and surfaces only
    //        as a 404 at call time in whichever repo takes the default brain.
    when('[t0] read from config', () => {
      then('model id by slug matches snapshot', () => {
        const modelBySlug = Object.fromEntries(
          Object.entries(CONFIG_BY_ATOM_SLUG).map(([slug, config]) => [
            slug,
            config.model,
          ]),
        );

        // .why = the snapshot alone carries no teeth here: `test:unit` always
        //        passes --updateSnapshot, so a wrong id would be recorded as
        //        the new truth rather than fail. this assertion is what makes
        //        the case bite — it fails if a slug is ever dropped from the
        //        map, which a re-recorded snapshot would otherwise absorb.
        expect(Object.keys(modelBySlug).sort()).toEqual(
          Object.keys(CONFIG_BY_ATOM_SLUG).sort(),
        );
        expect(Object.keys(modelBySlug).length).toBeGreaterThan(0);

        expect(modelBySlug).toMatchSnapshot();
      });

      then('every model id is account-qualified', () => {
        // .why = the loop below verifies zero ids if the config is empty, so
        //        the case would pass while it proved naught
        expect(Object.keys(CONFIG_BY_ATOM_SLUG).length).toBeGreaterThan(0);

        for (const config of Object.values(CONFIG_BY_ATOM_SLUG)) {
          expect(config.model).toMatch(/^accounts\/[\w-]+\/models\/[\w.-]+$/);
        }
      });

      // .why = clamps the regression where v4-flash pointed at the retired
      //        preview id and 404'd for every consumer on the default brain.
      //        stated as a plain assertion, not a snapshot, so it keeps its
      //        teeth even where the runner passes --updateSnapshot.
      then(
        'v4-flash points at the -0731 release id, not the retired preview',
        () => {
          expect(
            CONFIG_BY_ATOM_SLUG['fireworks/deepseek/flash/v4'].model,
          ).toEqual('accounts/fireworks/models/deepseek-v4-flash-0731');
        },
      );
    });
  });

  given('[case2] genBrainAtom factory', () => {
    when(
      '[t0] called with the retired fireworks/deepseek/flash/v4 slug',
      () => {
        const atom = genBrainAtom({ slug: 'fireworks/deepseek/flash/v4' });

        then('returns BrainAtom instance', () => {
          expect(atom).toBeInstanceOf(BrainAtom);
        });

        // 🔴 .why = the atom keeps the name it was asked by, so a registry
        //           selects it by that name. a rename to the successor made the
        //           retired name unselectable (the defect through v0.2.1).
        then('keeps the retired name it was asked by', () => {
          expect(atom.slug).toEqual('fireworks/deepseek/flash/v4');
        });

        then('the description names the successor it reaches', () => {
          expect(atom.description).toContain(
            'fireworks/deepseek/flash/v4 -> fireworks/deepseek/flash/v4.1',
          );
        });

        then('has correct repo', () => {
          expect(atom.repo).toEqual('fireworks');
        });

        then('spec matches snapshot', () => {
          expect(atom.spec).toBeDefined();
          expect(atom.spec).toMatchSnapshot();
        });
      },
    );

    // 🔴 .why = a registry selects by `atom.slug`, so a versionless name must
    //           survive onto the atom. an atom that renamed itself to the pin
    //           is one no consumer can choose by the name they hold.
    when('[t2] called with a versionless name', () => {
      const atomLatest = genBrainAtom({
        slug: 'fireworks/deepseek/flash/latest',
      });
      const atomBare = genBrainAtom({ slug: 'fireworks/deepseek/flash' });
      const atomPinned = genBrainAtom({
        slug: 'fireworks/deepseek/flash/v4.1',
      });

      then('the /latest atom keeps its /latest name', () => {
        expect(atomLatest.slug).toEqual('fireworks/deepseek/flash/latest');
      });

      then('the bare atom keeps its bare name', () => {
        expect(atomBare.slug).toEqual('fireworks/deepseek/flash');
      });

      then('both carry the spec of the pin they reach', () => {
        expect(atomLatest.spec).toEqual(atomPinned.spec);
        expect(atomBare.spec).toEqual(atomPinned.spec);
      });

      then('the description names the pin it reaches', () => {
        expect(atomBare.description).toContain(
          'fireworks/deepseek/flash -> fireworks/deepseek/flash/v4.1',
        );
      });
    });

    when('[t1] called with invalid slug', () => {
      then('throws BadRequestError with helpful message', async () => {
        const error = await getError(() =>
          // @ts-expect-error - invalid slug test case
          genBrainAtom({ slug: 'invalid/slug' }),
        );
        expect(error.message).toContain('invalid fireworks brain atom slug');
        expect(error.message).toMatchSnapshot();
      });
    });
  });
});
