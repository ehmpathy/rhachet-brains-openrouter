import { UnexpectedCodePathError } from 'helpful-errors';
import { type BrainAtom, genContextBrain } from 'rhachet';
import { given, then, when } from 'test-fns';

import { SPEC_ESTIMATE_BY_TIER } from '../../domain.operations/atom/BrainAtom.config';
import { TIER_BY_BARE_SLUG } from '../../domain.operations/atom/slug/AtomSlug.bare';
import { SLUGS_FILTERED_LISTED } from '../../domain.operations/atom/slug/AtomSlug.filtered';
import { getAllAtomSlugs } from '../../domain.operations/atom/slug/getAllAtomSlugs';
import { asSlugParts } from '../../domain.operations/supply/asSlugParts';
import { getBrainAtomsByOpenRouter } from './index';

/**
 * .what = every name this package promises a consumer may choose, forever
 * .why = stated as LITERALS, never read off a map. the registry is derived from
 *        the maps, so a map that quietly lost a row would shrink the registry
 *        and a derived check would agree. a literal cannot agree.
 *
 * 🔴 .note = only the tier names. each reads the newest model of its line from
 *           openrouter's catalog, so it never needs to retire. a model id is
 *           openrouter's to withdraw, so none is listed or promised. this list
 *           only grows: never delete a row.
 */
const SLUGS_PROMISED_FOREVER = [
  'openrouter/deepseek/pro',
  'openrouter/deepseek/flash',
  'openrouter/moonshotai/pro',
  'openrouter/z-ai/pro',
  'openrouter/z-ai/flash',
] as const;

/**
 * .what = the brain a consumer gets when they choose a slug by name
 * .why = the consumer's path, verbatim: rhachet's own `genContextBrain`, whose
 *        match is exact on `atom.slug`. pure and in-memory in explicit mode, so
 *        this runs on every unit pass with no credentials
 */
const getOneBrainChosen = (input: { choice: string }): BrainAtom =>
  genContextBrain({
    brains: { atoms: getBrainAtomsByOpenRouter() },
    choice: { atom: input.choice },
  }).brain.choice;

/**
 * .what = the spec a slug's atom must carry: the estimate of the tier its base names
 * .why = a filtered slug exports the SAME brain as its tier, never a lookalike
 */
const getOneSpecOwed = (input: { slug: string }) => {
  const { base } = asSlugParts({ slug: input.slug });
  const known = getAllAtomSlugs().find((slug) => slug === base);
  if (!known)
    throw new UnexpectedCodePathError('listed slug has no known base', {
      slug: input.slug,
      base,
    });
  return TIER_BY_BARE_SLUG[known].spec;
};

describe('getBrainAtomsByOpenRouter', () => {
  given('[case1] the published catalog', () => {
    const atoms = getBrainAtomsByOpenRouter();
    const slugs = atoms.map((atom) => atom.slug);

    when('[t0] the listed slugs are read', () => {
      then('no slug appears twice', () => {
        // .why = rhachet refuses a registry with a duplicate {repo, slug}
        expect(slugs.length).toEqual(new Set(slugs).size);
      });

      then('every accepted name, and every listed filter, is listed', () => {
        expect([...slugs].sort()).toEqual(
          [...getAllAtomSlugs(), ...SLUGS_FILTERED_LISTED].sort(),
        );
      });

      then('no listed atom is a pattern', () => {
        // .why = a pattern names no model (case=20, case=6); it is declared to
        //        rhachet as a pattern, never listed as a brain
        for (const slug of slugs) expect(slug).not.toContain('*');
      });

      then('each atom carries the estimate of its tier', () => {
        for (const atom of atoms)
          expect(atom.spec).toEqual(getOneSpecOwed({ slug: atom.slug }));
      });
    });

    // 🔴 .why = a consumer never calls `genBrainAtom`; it names a `choice`, and
    //           rhachet matches it exact on `atom.slug`. a name accepted but
    //           unlisted is a broken promise behind a green unit suite
    //           (`rule.require.versionless-slugs-selectable`)
    when(
      '[t1] each name promised forever is chosen via genContextBrain',
      () => {
        then('each is found, under the exact name chosen', () => {
          for (const slug of SLUGS_PROMISED_FOREVER)
            expect(getOneBrainChosen({ choice: slug }).slug).toEqual(slug);
        });

        then('each chosen brain carries the estimate of its tier', () => {
          for (const slug of SLUGS_PROMISED_FOREVER)
            expect(getOneBrainChosen({ choice: slug }).spec).toEqual(
              getOneSpecOwed({ slug }),
            );
        });

        then('every tier name listed is promised forever', () => {
          // .why = a tier listed but not in the literal list is a promise
          //        made with no clamp; add it above in the same change
          expect(Object.keys(TIER_BY_BARE_SLUG).sort()).toEqual(
            [...SLUGS_PROMISED_FOREVER].sort(),
          );
        });
      },
    );

    when('[t2] a tier name is chosen via genContextBrain', () => {
      then('its description names the line it reads, never a version', () => {
        const brain = getOneBrainChosen({
          choice: 'openrouter/deepseek/flash',
        });
        expect(brain.description).toContain(
          'openrouter/deepseek/flash -> newest',
        );
      });
    });
  });

  // .why = until rhachet routes a pattern (ehmpathy/rhachet#574), a filtered
  //        slug is choosable only if listed. the preferred floor must be
  given('[case2] the hardcoded preferred floor', () => {
    const choice =
      'openrouter/deepseek/flash/floor&speed=min50tps&privacy=full';

    when('[t0] a consumer chooses it by exact name via genContextBrain', () => {
      then('it is found, under the exact name chosen', () => {
        expect(getOneBrainChosen({ choice }).slug).toEqual(choice);
      });

      then('it carries the flash tier estimate', () => {
        expect(getOneBrainChosen({ choice }).spec).toEqual(
          SPEC_ESTIMATE_BY_TIER.flash,
        );
      });
    });
  });
});
