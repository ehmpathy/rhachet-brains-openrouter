import { ConstraintError } from 'helpful-errors';
import { BrainAtom } from 'rhachet';
import { getError, given, then, when } from 'test-fns';

import { SPEC_ESTIMATE_BY_TIER } from '../../domain.operations/atom/BrainAtom.config';
import { genBrainAtom } from '../../domain.operations/atom/genBrainAtom';
import { SLUGS_FILTERED_LISTED } from '../../domain.operations/atom/slug/AtomSlug.filtered';
import { SPEC_ESTIMATE_UNLISTED } from '../../domain.operations/atom/slug/AtomSlug.unlisted';
import { getAllAtomSlugs } from '../../domain.operations/atom/slug/getAllAtomSlugs';
import { getBrainAtomsByOpenRouter } from './index';

describe('rhachet-brains-openrouter.unit', () => {
  given('[case1] getBrainAtomsByOpenRouter', () => {
    when('[t0] called', () => {
      const atoms = getBrainAtomsByOpenRouter();
      const slugs = atoms.map((a: BrainAtom) => a.slug);

      // .why = the count is DERIVED from the slug maps, never hardcoded; a
      //        literal drifts the moment the catalog changes
      then('exports every accepted name, under its own name', () => {
        expect([...slugs].sort()).toEqual(
          [...getAllAtomSlugs(), ...SLUGS_FILTERED_LISTED].sort(),
        );
      });

      then('returns BrainAtom instances, each of repo openrouter', () => {
        // .why = the loop verifies naught if the array is empty
        expect(atoms.length).toBeGreaterThan(0);
        for (const atom of atoms) {
          expect(atom).toBeInstanceOf(BrainAtom);
          expect(atom.repo).toEqual('openrouter');
        }
      });

      then('every slug opens with openrouter/', () => {
        for (const slug of slugs) expect(slug).toMatch(/^openrouter\//);
      });

      then('slugs match snapshot', () => {
        expect(slugs).toMatchSnapshot();
      });

      then('specs match snapshot', () => {
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

  // 🔴 .why = a LITERAL list of the tiers fails the day one is dropped; a
  //           derived count would agree with a map that lost a row
  given('[case1b] the tier names', () => {
    when('[t0] read from the registry', () => {
      then('they are exactly the five tiers', () => {
        expect([...getAllAtomSlugs()].sort()).toEqual(
          [
            'openrouter/deepseek/pro',
            'openrouter/deepseek/flash',
            'openrouter/moonshotai/pro',
            'openrouter/z-ai/pro',
            'openrouter/z-ai/flash',
          ].sort(),
        );
      });
    });
  });

  given('[case2] genBrainAtom factory', () => {
    when('[t0] called with a tier slug', () => {
      const atom = genBrainAtom({ slug: 'openrouter/z-ai/pro' });

      then('returns a BrainAtom of repo openrouter', () => {
        expect(atom).toBeInstanceOf(BrainAtom);
        expect(atom.repo).toEqual('openrouter');
      });

      // 🔴 .why = a registry selects by `atom.slug`; an atom that renamed
      //           itself is one no consumer can choose by the name they hold
      then('keeps its tier name', () => {
        expect(atom.slug).toEqual('openrouter/z-ai/pro');
      });

      then('carries the pro tier estimate, and says so', () => {
        expect(atom.spec).toEqual(SPEC_ESTIMATE_BY_TIER.pro);
        expect(atom.description).toContain('estimate');
        expect(atom.spec).toMatchSnapshot();
      });
    });

    when('[t1] called with a filtered tier slug', () => {
      const atom = genBrainAtom({
        slug: 'openrouter/z-ai/flash/floor&speed.min=50tps&region=usa',
      });

      then('it keeps the full filtered name', () => {
        expect(atom.slug).toEqual(
          'openrouter/z-ai/flash/floor&speed.min=50tps&region=usa',
        );
      });

      then('it carries the estimate of its tier', () => {
        expect(atom.spec).toEqual(SPEC_ESTIMATE_BY_TIER.flash);
      });
    });

    when('[t2] called with an unlisted id', () => {
      const atom = genBrainAtom({ slug: 'openrouter/z-ai/glm-5.3' });

      then('it keeps the id as its name, with the unlisted estimate', () => {
        expect(atom.slug).toEqual('openrouter/z-ai/glm-5.3');
        expect(atom.spec).toEqual(SPEC_ESTIMATE_UNLISTED);
      });
    });

    when('[t3] called with an invalid slug', () => {
      then('throws a ConstraintError that names both valid forms', async () => {
        const error = await getError(() =>
          // @ts-expect-error - invalid slug test case
          genBrainAtom({ slug: 'invalid/slug' }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('names no openrouter model');
        expect(error.message).toMatchSnapshot();
      });
    });
  });
});
