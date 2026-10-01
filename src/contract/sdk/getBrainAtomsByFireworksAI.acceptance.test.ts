import { BadRequestError } from 'helpful-errors';
import { type BrainAtom, genContextBrain } from 'rhachet';
import {
  asPinnedAtomSlug,
  type BrainAtomSlugFireworks,
  getBrainAtomsByFireworksAI,
  PINNED_BY_LEGACY_SLUG,
  RETIREMENT_BY_ATOM_SLUG,
} from 'rhachet-brains-fireworksai';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

/**
 * .what = every redirect a consumer may hold — a legacy name, or a retired pin
 *         — read off the PUBLISHED registries
 * .why = the promise to a consumer on an old name is that `choice: <old name>`
 *        still finds a brain: one that answers, or one that names the fix
 */
const getAllRedirectSlugsLive = (): BrainAtomSlugFireworks[] => [
  ...(Object.keys(PINNED_BY_LEGACY_SLUG) as BrainAtomSlugFireworks[]),
  ...(Object.keys(RETIREMENT_BY_ATOM_SLUG) as BrainAtomSlugFireworks[]),
];

/**
 * .what = the brain a consumer gets when they choose a slug by name
 * .why = this is the consumer's path, verbatim: register this package's atoms
 *        with rhachet, then name a `choice`. rhachet matches on `atom.slug`,
 *        exact — so this proves selection, never mere acceptance
 */
const getOneBrainChosen = (input: { choice: string }): BrainAtom =>
  genContextBrain({
    brains: { atoms: getBrainAtomsByFireworksAI() },
    choice: { atom: input.choice },
    creds: async () => ({ FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY }),
  }).brain.choice;

describe('getBrainAtomsByFireworksAI.acceptance', () => {
  // 🔴 .why = the clamp for the report "fireworks/deepseek/v4-flash is not
  //           accessible". through v0.2.1, `genBrainAtom` accepted every
  //           legacy name, but the registry omitted them and the atom renamed
  //           itself to its successor — so a consumer's choice matched no brain.
  //           this suite goes through the PUBLISHED package and rhachet's own
  //           selection, which is the only surface a consumer touches.
  //           (`rule.require.redirected-slugs-selectable`)
  given('[case1] every redirect a consumer may hold', () => {
    when('[t0] each is chosen by name via genContextBrain', () => {
      then('the redirect set is not empty', () => {
        // .why = guards the guard — an empty set would pass every check below
        expect(getAllRedirectSlugsLive().length).toBeGreaterThan(0);
      });

      then('each choice resolves to a brain under the name chosen', () => {
        for (const slug of getAllRedirectSlugsLive()) {
          const brain = getOneBrainChosen({ choice: slug });
          expect(brain.slug).toEqual(slug);
        }
      });

      then('each chosen brain carries the spec of the pin it reaches', () => {
        for (const slug of getAllRedirectSlugsLive()) {
          const brainRedirect = getOneBrainChosen({ choice: slug });
          const brainPinned = getOneBrainChosen({
            choice: asPinnedAtomSlug({ slug }),
          });
          expect(brainRedirect.spec).toEqual(brainPinned.spec);
        }
      });
    });
  });

  given('[case2] the reported legacy name fireworks/deepseek/v4-flash', () => {
    when('[t0] it is chosen by name', () => {
      then('it resolves, and names v4.1-flash as the model it reaches', () => {
        const brain = getOneBrainChosen({
          choice: 'fireworks/deepseek/v4-flash',
        });
        expect(brain.slug).toEqual('fireworks/deepseek/v4-flash');
        expect(brain.description).toContain(
          'fireworks/deepseek/v4-flash -> fireworks/deepseek/flash/v4.1',
        );
      });
    });

    when('[t1] the chosen brain is asked a question, live', () => {
      // .why = selection proves the name is honored; only a live answer proves
      //        the redirect lands on a model fireworks actually serves
      const result = useThen('it answers', async () => {
        if (!process.env.FIREWORKS_API_KEY)
          throw new BadRequestError('FIREWORKS_API_KEY required', {
            hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
          });
        return getOneBrainChosen({
          choice: 'fireworks/deepseek/v4-flash',
        }).ask({
          role: {},
          prompt: 'reply with exactly: "hello from a legacy slug"',
          schema: { output: z.object({ message: z.string() }) },
        });
      });

      then('the answer carries output', () => {
        expect(result.output).not.toBeNull();
      });
    });
  });

  // .why = a name retired with several replacements still finds its brain.
  //        fireworks withdrew the model, so the ask fails — and it must fail
  //        with OUR error that names each replacement, never rhachet's bare
  //        "brain not found" for a name we simply forgot to list.
  given('[case3] a legacy name retired among several replacements', () => {
    when('[t0] fireworks/kimi/k2.6 is chosen and asked, live', () => {
      const error = useThen('it fails', async () => {
        if (!process.env.FIREWORKS_API_KEY)
          throw new BadRequestError('FIREWORKS_API_KEY required', {
            hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
          });
        const errorCaught = await getError(
          getOneBrainChosen({ choice: 'fireworks/kimi/k2.6' }).ask({
            role: {},
            prompt: 'reply with exactly: "hello"',
            schema: { output: z.object({ message: z.string() }) },
          }),
        );

        // .note = return plain data; an Error's `message` is non-enumerable
        //         and does not survive the useThen proxy
        return { message: errorCaught.message };
      });

      then('the error names the retirement', () => {
        expect(error.message).toContain(
          "'fireworks/kimi/pro/k2.6' was retired by fireworks",
        );
      });

      then('the error lists each replacement', () => {
        expect(error.message).toContain('fireworks/glm/pro/5.3');
        expect(error.message).toContain('fireworks/kimi/pro/k3');
      });
    });
  });
});
