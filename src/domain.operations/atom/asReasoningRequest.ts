import { ConstraintError } from 'helpful-errors';
import type { BrainEffort } from 'rhachet/brains';

import type { OpenRouterReasoning } from '../../domain.objects/OpenRouterReasoning';
import { EFFORT_SUPPORTED_OPENROUTER } from './EFFORT_SUPPORTED_OPENROUTER';

/**
 * .what = the valid shapes, named in every refusal
 */
const asValidShapes = (input: { levels: string[] }): string[] => [
  '',
  'valid shapes, one of:',
  `  - effort: ${input.levels.map((level) => `'${level}'`).join(' | ')}   (≡ { level: … })`,
  '  - effort: { budget: { tokens: N } }   N a positive integer',
];

/**
 * .what = refuses one effort with the valid shapes named
 * .why = a bad effort would bill thought the caller did not ask for; refuse before spend
 */
const failOnEffort = (input: {
  effort: unknown;
  why: string;
  slug: string;
  levels: string[];
}): never => {
  // a string echoes in single quotes, as the filter refusals do; a shape echoes as json
  const effortEcho =
    typeof input.effort === 'string'
      ? `'${input.effort}'`
      : JSON.stringify(input.effort);
  throw new ConstraintError(
    [
      `invalid effort for ${input.slug}: ${input.why}`,
      `  got: effort = ${effortEcho}`,
      ...asValidShapes({ levels: input.levels }),
    ].join('\n'),
    { effort: input.effort, slug: input.slug },
  );
};

/**
 * .what = casts the ask's effort onto openrouter's `reasoning` request field
 * .why = the ask carries rhachet's generic effort (ehmpathy/rhachet#595); openrouter reads
 *        `reasoning: { effort } | { max_tokens }`. a malformed effort is refused here,
 *        before any network call, never dropped (a drop bills thought with no signal)
 *
 * .note = a bare string aliases `{ level }`. rhachet#595 normalizes it too; this is a no-op
 *         on an object, so both may run
 * .note = unset returns null: no `reasoning` key is sent, as 0.1.3
 */
export const asReasoningRequest = (input: {
  effort: BrainEffort | null;
  slug: string;
}): OpenRouterReasoning | null => {
  // unset: the host's default, as 0.1.3
  if (input.effort === null) return null;
  const { levels } = EFFORT_SUPPORTED_OPENROUTER;
  const fail = (failure: { why: string }) =>
    failOnEffort({
      effort: input.effort,
      why: failure.why,
      slug: input.slug,
      levels,
    });

  // the alias: a bare string is a level
  const effort: unknown =
    typeof input.effort === 'string' ? { level: input.effort } : input.effort;
  if (typeof effort !== 'object' || effort === null)
    return fail({ why: 'not a level nor a budget' });

  // one form, never both (a cast past PickOne)
  const level = 'level' in effort ? effort.level : undefined;
  const budget = 'budget' in effort ? effort.budget : undefined;
  if (level !== undefined && budget !== undefined)
    return fail({ why: 'both level and budget; openrouter takes one' });

  // a level: one this brain lists
  if (level !== undefined) {
    if (typeof level !== 'string' || !levels.includes(level))
      return fail({ why: `level not in ${levels.join(' | ')}` });
    return { effort: level };
  }

  // a budget: a positive integer count of tokens
  const tokens =
    typeof budget === 'object' && budget !== null && 'tokens' in budget
      ? budget.tokens
      : undefined;
  if (budget === undefined) return fail({ why: 'neither level nor budget' });
  if (typeof tokens !== 'number' || !Number.isInteger(tokens) || tokens <= 0)
    return fail({ why: 'tokens must be a positive integer' });
  return { max_tokens: tokens };
};
