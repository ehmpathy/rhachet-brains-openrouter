import type { OpenRouterCatalogModel } from '../../domain.objects/OpenRouterCatalogModel';

/**
 * .what = the edit distance between two strings
 * .why = a typo is a few edits away from the id it meant; the count of edits
 *        ranks the catalog by how likely each id was the one intended
 *
 * .note = deliberate mutation: the textbook two-row dynamic program, O(m×n) time
 *         and O(n) memory. two fixed rows are reused in place; neither escapes
 *         this function, so no caller can observe the mutation
 */
const getOneEditDistance = (input: { from: string; into: string }): number => {
  const { from, into } = input;
  let rowPrior = Array.from({ length: into.length + 1 }, (_, j) => j);
  let rowNext = Array.from({ length: into.length + 1 }, () => 0);
  for (let i = 0; i < from.length; i += 1) {
    rowNext[0] = i + 1;
    for (let j = 0; j < into.length; j += 1)
      rowNext[j + 1] = Math.min(
        (rowPrior[j + 1] ?? 0) + 1, // drop a char
        (rowNext[j] ?? 0) + 1, // add a char
        (rowPrior[j] ?? 0) + (from[i] === into[j] ? 0 : 1), // swap a char
      );
    [rowPrior, rowNext] = [rowNext, rowPrior];
  }
  return rowPrior[into.length] ?? 0;
};

/**
 * .what = the undated catalog ids nearest to an id
 * .why = an unknown or withdrawn id needs a place to go; the refusal names the
 *        ids it likely meant, so the fix is a copy-paste
 *
 * .note = ranked by edit distance, then alphabetically, so the order is stable
 * .note = a dated id is never offered. it may still serve today, yet openrouter
 *         has scheduled its withdrawal, so it is no place to send a caller (F23)
 */
export const getAllSimilarModelIds = (input: {
  id: string;
  catalog: OpenRouterCatalogModel[];
  limit: number;
}): string[] =>
  input.catalog
    .filter((model) => model.expiresOn === null)
    .map(({ id }) => ({
      id,
      distance: getOneEditDistance({ from: input.id, into: id }),
    }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, input.limit)
    .map((scored) => scored.id);
