import { ConstraintError, UnexpectedCodePathError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '../..');

/**
 * .what = the probe command body from the readme's "confirm it works" step
 * .why = the wish owes one command that proves a key works; this test runs
 *        that command as written, so the readme cannot drift from the contract
 *
 * .note = one substitution: `env: 'prod'` → `env: 'test'`. the readme speaks to
 *         a consumer's prod key; this suite holds a test key only
 */
const getProbeCommand = (): string => {
  const readme = readFileSync(path.join(REPO_ROOT, 'readme.md'), 'utf8');
  const step = readme.split('### 5. confirm it works')[1]?.split('## usage')[0];
  const body = step?.match(/```sh\nnode -e "\n([\s\S]*?)"\n```/)?.[1];
  if (!body)
    throw new UnexpectedCodePathError(
      'readme step 5 holds no `node -e` probe block',
      { hint: 'restore the probe in readme.md, step 5' },
    );
  return body.replace("env: 'prod'", "env: 'test'");
};

/**
 * .what = the probe's printed line, with the live answer and charge masked
 * .why = the snapshot must show the line the readme promises, yet the model's
 *        words and the fraction of a cent it costs move per call
 */
const asStableProbeLine = (input: { stdout: string }): string =>
  input.stdout
    .trim()
    .replace(/output: '[^']*'/, "output: '(live answer)'")
    .replace(/cost: 'USD [\d._]+'/, "cost: '(live charge)'");

describe('readme', () => {
  given('[case1] a key in keyrack, and the readme probe', () => {
    when('[t0] the probe runs, as the readme writes it', () => {
      const probe = useThen('it exits clean', async () => {
        if (!process.env.OPENROUTER_API_KEY)
          throw new ConstraintError('OPENROUTER_API_KEY required', {
            hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
          });
        // .note = FORCE_COLOR off, so the printed object reads as plain text
        const stdout = execFileSync('node', ['-e', getProbeCommand()], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 120_000,
          env: { ...process.env, FORCE_COLOR: '0' },
        });
        return { stdout };
      });

      then('it prints that openrouter answered', () => {
        expect(probe.stdout).toContain('✔ openrouter answered');
      });

      then('it prints the answer, and the charge in usd', () => {
        expect(probe.stdout).toMatch(/output: '[^']*ok/i);
        expect(probe.stdout).toMatch(/cost: 'USD [\d._]+'/);
      });

      then('the line a human reads matches snapshot', () => {
        expect(asStableProbeLine({ stdout: probe.stdout })).toMatchSnapshot();
      });
    });
  });
});
