/**
 * .what = the effort forms every openrouter atom honors
 * .why = openrouter takes `reasoning.effort` or `reasoning.max_tokens`. of its levels, four
 *        are caps: `none` turns thought off, and `xhigh` / `max` cap naught useful
 *
 * .note = a model whose hosts do not list `reasoning` is refused at the funnel (case=6)
 */
export const EFFORT_SUPPORTED_OPENROUTER = {
  levels: ['minimal', 'low', 'medium', 'high'],
  budget: true,
};
