import { ConstraintError } from 'helpful-errors';
import type { BrainPlugToolDefinition } from 'rhachet/brains';

import { asOpenRouterToolName } from './asOpenRouterToolName';

/**
 * .what = each plugged tool's slug, keyed by the function name it is sent under
 * .why = a tool call names the function, never the slug; this map turns it back
 *        into the slug the caller plugged
 *
 * .note = two slugs that cast to one name would make a tool call ambiguous, so
 *         the ask is refused before any spend, with both slugs named
 */
export const asToolSlugByName = (input: {
  tools: BrainPlugToolDefinition[];
}): Record<string, string> => {
  // pair each slug with the name it is sent under
  const pairs = input.tools.map((tool) => ({
    name: asOpenRouterToolName({ slug: tool.slug }),
    slug: tool.slug,
  }));

  // refuse two distinct slugs that share a name
  const clash = pairs.find((pair) =>
    pairs.some((peer) => peer.name === pair.name && peer.slug !== pair.slug),
  );
  if (clash) {
    const slugs = pairs
      .filter((pair) => pair.name === clash.name)
      .map((pair) => pair.slug);
    throw new ConstraintError(
      [
        `tools ${slugs.map((slug) => `'${slug}'`).join(' and ')} both send as function '${clash.name}'. no call was sent.`,
        '',
        'fix: rename one slug so they differ in a letter, digit, `_`, or `-`',
      ].join('\n'),
      { slugs, name: clash.name },
    );
  }

  return Object.fromEntries(pairs.map((pair) => [pair.name, pair.slug]));
};
