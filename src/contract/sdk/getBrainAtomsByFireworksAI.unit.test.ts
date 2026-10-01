import { type BrainAtom, genContextBrain } from 'rhachet';
import { given, then, when } from 'test-fns';

import { CONFIG_BY_ATOM_SLUG } from '../../domain.operations/atom/BrainAtom.config';
import { asPinnedAtomSlug } from '../../domain.operations/atom/slug/asPinnedAtomSlug';
import { getAllAtomSlugs } from '../../domain.operations/atom/slug/getAllAtomSlugs';
import { getBrainAtomsByFireworksAI } from './index';

/**
 * .what = every name this package ever shipped outside the canonical shape
 * .why = stated as LITERALS, never read off a map. the registry is derived from
 *        the maps, so a map that quietly lost a row would shrink the registry
 *        and a derived check would agree. a literal cannot agree.
 *
 * 🔴 .note = this list only ever GROWS. a name here was promised forever.
 */
const SLUGS_PROMISED_FOREVER = [
  // legacy — published before the tier segment
  'fireworks/deepseek/v4-pro',
  'fireworks/deepseek/v4.1-flash',
  'fireworks/deepseek/v4-flash',
  'fireworks/kimi/k3',
  'fireworks/kimi/k2.7-code',
  'fireworks/kimi/k2.6',
  'fireworks/glm/5.3',
  'fireworks/glm/5.3-flash',
  'fireworks/glm/5.2',
  'fireworks/minimax/m3',
  'fireworks/gpt-oss/120b',
  'fireworks/nemotron/3.5-lightning',
  // retired — routed to one successor, or ambiguous among several
  'fireworks/deepseek/flash/v4',
  'fireworks/deepseek/pro/v4',
  'fireworks/glm/pro/5.2',
  'fireworks/kimi/pro/k2.6',
  'fireworks/kimi/code/k2.7',
] as const;

/**
 * .what = the brain a consumer gets when they choose a slug by name
 * .why = the consumer's path, verbatim: rhachet's own `genContextBrain`, whose
 *        match is exact on `atom.slug`. pure and in-memory in explicit mode, so
 *        this runs on every unit pass with no credentials
 */
const getOneBrainChosen = (input: { choice: string }): BrainAtom =>
  genContextBrain({
    brains: { atoms: getBrainAtomsByFireworksAI() },
    choice: { atom: input.choice },
  }).brain.choice;

describe('getBrainAtomsByFireworksAI', () => {
  given('[case1] the published catalog', () => {
    const atoms = getBrainAtomsByFireworksAI();
    const slugs = atoms.map((atom) => atom.slug);

    when('[t0] the listed slugs are read', () => {
      then('no slug appears twice', () => {
        // .why = rhachet refuses a registry with a duplicate {repo, slug}
        expect(slugs.length).toEqual(new Set(slugs).size);
      });

      then('every accepted name is listed', () => {
        expect([...slugs].sort()).toEqual([...getAllAtomSlugs()].sort());
      });

      then('each atom carries the spec of the pin it reaches', () => {
        // .why = an alias exports the SAME brain, never a lookalike
        for (const slug of getAllAtomSlugs()) {
          const atom = atoms.find((one) => one.slug === slug);
          expect(atom?.spec).toEqual(
            CONFIG_BY_ATOM_SLUG[asPinnedAtomSlug({ slug })].spec,
          );
        }
      });
    });

    // 🔴 .why = the clamp for the defect that shipped through v0.2.1: every
    //           legacy name and every retirement was accepted by `genBrainAtom`,
    //           ABSENT from this list, and renamed to its successor on the atom.
    //           so `choice: 'fireworks/deepseek/v4-flash'` matched no brain.
    //           (`rule.require.redirected-slugs-selectable`)
    when(
      '[t1] each name promised forever is chosen via genContextBrain',
      () => {
        then('each is found, under the exact name chosen', () => {
          for (const slug of SLUGS_PROMISED_FOREVER) {
            expect(getOneBrainChosen({ choice: slug }).slug).toEqual(slug);
          }
        });

        then('each chosen brain carries the spec of the pin it reaches', () => {
          for (const slug of SLUGS_PROMISED_FOREVER) {
            expect(getOneBrainChosen({ choice: slug }).spec).toEqual(
              CONFIG_BY_ATOM_SLUG[asPinnedAtomSlug({ slug })].spec,
            );
          }
        });

        then('the reported name reaches v4.1-flash, and says so', () => {
          const brain = getOneBrainChosen({
            choice: 'fireworks/deepseek/v4-flash',
          });
          expect(brain.spec).toEqual(
            CONFIG_BY_ATOM_SLUG['fireworks/deepseek/flash/v4.1'].spec,
          );
          expect(brain.description).toContain(
            'fireworks/deepseek/v4-flash -> fireworks/deepseek/flash/v4.1',
          );
        });
      },
    );

    // .why = the clamp for the defect that shipped in v0.2.0: every `/latest`
    //        slug was accepted and absent. (`rule.require.versionless-slugs-selectable`)
    when('[t2] each versionless name is chosen via genContextBrain', () => {
      then('the bare and /latest deepseek flash names are found', () => {
        for (const slug of [
          'fireworks/deepseek/flash',
          'fireworks/deepseek/flash/latest',
        ]) {
          expect(getOneBrainChosen({ choice: slug }).slug).toEqual(slug);
        }
      });
    });
  });
});
