import { given, then, when } from 'test-fns';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getAllAtomSlugs } from '../domain.operations/atom/slug/getAllAtomSlugs';

/**
 * .what = the readme a stranger follows from no account to a first call
 * .why = the wish owes that walk; a cut step strands every new adopter (case=1)
 *
 * .note = an integration test, since it reads the filesystem
 */
const README = readFileSync(path.join(__dirname, '../../readme.md'), 'utf8');

/**
 * .what = each step the wish and case=1 owe, with the words that prove it is there
 * .why = stated as literals, so a reword that drops a step goes red
 */
const STEPS_OWED = [
  { step: '### 1. make an account', proof: 'https://openrouter.ai' },
  {
    step: '### 2. provision the wallet',
    proof: 'https://openrouter.ai/settings/credits',
  },
  { step: '### 2. provision the wallet', proof: 'auto\ntop-up **off**' },
  { step: '### 3. mint a key', proof: 'https://openrouter.ai/settings/keys' },
  { step: '### 3. mint a key', proof: '**credit limit**' },
  { step: '### 3. mint a key', proof: 'copy it now' },
  { step: '### 4. store it in keyrack', proof: 'rhx keyrack fill' },
  {
    step: '### 5. confirm it works — one command',
    proof: '✔ openrouter answered',
  },
];

describe('readme', () => {
  given('[case1] the setup a stranger follows', () => {
    when('[t0] the readme is read', () => {
      then('each owed step is a header, with the words that prove it', () => {
        for (const owed of STEPS_OWED) {
          expect(README).toContain(owed.step);
          expect(README).toContain(owed.proof);
        }
      });

      then('the steps appear in order', () => {
        const offsets = [...new Set(STEPS_OWED.map((owed) => owed.step))].map(
          (step) => README.indexOf(step),
        );
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      });
    });
  });

  // .why = discovery is the shortest path a consumer has; the readme must show
  //        it, and the acceptance suite runs the same call live (case1b)
  given('[case3] brain discovery via rhachet', () => {
    when('[t0] the readme is read', () => {
      then('it shows a choice by discovery, with no brain list', () => {
        expect(README).toContain('await genContextBrain({');
        expect(README).toContain(
          "choice: { atom: 'openrouter/deepseek/flash' }",
        );
        expect(README).toContain('rhachet-brains-*');
      });

      then('it orders the ways in: discovery, specification, direct', () => {
        const offsets = [
          '### 1. context discovery',
          '### 2. context specification',
          '### 3. direct access',
        ].map((header) => README.indexOf(header));
        expect(offsets.every((offset) => offset >= 0)).toEqual(true);
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      });
    });
  });

  // .why = the tier table is what a caller reads to learn which names they may
  //        choose; a tier added or dropped without the readme goes red here
  given('[case2] the tier table', () => {
    when('[t0] each tier is read from the registry', () => {
      const tiers = getAllAtomSlugs();

      then('the set is not empty', () => {
        expect(tiers.length).toBeGreaterThan(0);
      });

      then('the readme names each tier', () => {
        for (const tier of tiers) expect(README).toContain(`\`${tier}\``);
      });
    });
  });
});
