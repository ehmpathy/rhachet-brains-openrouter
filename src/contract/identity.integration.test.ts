import { given, then, useBeforeAll, when } from 'test-fns';

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * .what = the repo root, where git and package.json live
 * .why = every read below is relative to it, whatever cwd jest was started in
 */
const REPO_ROOT = path.join(__dirname, '../..');

/**
 * .what = every file a commit would carry: tracked, plus untracked and not ignored
 * .why = a stray name in a new file ships as surely as one in a tracked file
 *
 * .note = a file deleted from the worktree but still in the index is skipped;
 *         its deletion is what ships. a symlink to a directory is skipped too;
 *         the files it reaches are listed on their own
 */
const getAllFilesShipped = (): string[] =>
  [
    ...new Set(
      execSync('git ls-files --cached --others --exclude-standard', {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      })
        .split('\n')
        .filter((file) => file.length > 0),
    ),
  ].filter((file) => {
    const filePath = path.join(REPO_ROOT, file);
    return existsSync(filePath) && statSync(filePath).isFile();
  });

/**
 * .what = the files whose content matches a pattern
 * .why = a red clamp names each file, so the fix is one open away
 */
const getAllFilesMatched = (input: {
  files: string[];
  pattern: RegExp;
}): string[] =>
  input.files.filter((file) =>
    input.pattern.test(readFileSync(path.join(REPO_ROOT, file), 'utf8')),
  );

/**
 * .what = files exempt from the predecessor-name check, each with its reason
 * .why = an exemption with no reason is a hole; each one here is argued
 */
const FILES_EXEMPT: { matches: (file: string) => boolean; why: string }[] = [
  {
    matches: (file) => file.startsWith('.behavior/'),
    why: 'a route that records the swap must name what it swapped from (F22)',
  },
  {
    matches: (file) => /^\.dream\/[^/]*\.reseed\./.test(file),
    why: 'a reseed dream targets another repo, and must name that repo state verbatim (e.g. a reviewer role whose default brain is still a predecessor slug)',
  },
  {
    matches: (file) => file === 'pnpm-lock.yaml',
    why: 'generated; the reviewer roles (rhachet-roles-bhrain, -bhuild) declare the predecessor brain package as a peer, which this repo does not import',
  },
  {
    matches: (file) => file === 'src/contract/identity.integration.test.ts',
    why: 'this clamp must spell the name it hunts',
  },
];

describe('identity', () => {
  given('[case8] the repo after the swap from the predecessor provider', () => {
    const scene = useBeforeAll(async () => {
      const files = getAllFilesShipped();
      return {
        files,
        filesChecked: files.filter(
          (file) => !FILES_EXEMPT.some((exempt) => exempt.matches(file)),
        ),
      };
    });

    when('[t0] every shipped file is read for the predecessor name', () => {
      then('the set read is not empty', () => {
        // .why = guards the guard; an empty list passes every check below
        expect(scene.filesChecked.length).toBeGreaterThan(10);
      });

      then('no file names fireworks', () => {
        expect(
          getAllFilesMatched({
            files: scene.filesChecked,
            pattern: /fireworks/i,
          }),
        ).toEqual([]);
      });
    });

    when('[t1] package.json is read', () => {
      const pkg = useBeforeAll(async () =>
        JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')),
      );

      then('the name is rhachet-brains-openrouter', () => {
        expect(pkg.name).toEqual('rhachet-brains-openrouter');
      });

      then('the repository is ehmpathy/rhachet-brains-openrouter', () => {
        expect(pkg.repository).toEqual('ehmpathy/rhachet-brains-openrouter');
      });
    });

    when('[t2] the keyrack manifest is read', () => {
      // .note = an object, never a bare string: useBeforeAll returns a proxy
      const manifest = useBeforeAll(async () => ({
        content: readFileSync(
          path.join(REPO_ROOT, '.agent/keyrack.yml'),
          'utf8',
        ),
      }));

      then('it lists OPENROUTER_API_KEY', () => {
        expect(manifest.content).toContain('OPENROUTER_API_KEY');
      });

      then('it lists no key of the predecessor', () => {
        expect(manifest.content).not.toMatch(/FIREWORKS_/);
      });
    });

    when('[t3] the repo-local briefs are read', () => {
      then('none names either ancestor provider', () => {
        const briefs = scene.files.filter((file) =>
          file.startsWith('.agent/repo=.this/'),
        );
        expect(briefs.length).toBeGreaterThan(0);
        expect(
          getAllFilesMatched({
            files: briefs,
            pattern: /fireworks|\bxai\b|\bgrok\b/i,
          }),
        ).toEqual([]);
      });
    });
  });
});
