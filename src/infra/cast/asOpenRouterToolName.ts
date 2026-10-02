/**
 * .what = the function name a tool slug is sent under
 * .why = the openai function spec allows only `a-z A-Z 0-9 _ -`, up to 64 chars.
 *        a rhachet slug like `weather.lookup` breaks it, and a strict host
 *        refuses the whole ask (measured 2026-10-02: decart, 400
 *        `backend_invalid_argument`). a lax host hid the defect until the floor
 *        walk reached a strict one
 *
 * .note = each disallowed char becomes `_`; the reply maps a name back to its
 *         slug by lookup over the plugged tools (`asToolSlugByName`), never by a
 *         reverse of this cast
 *
 * .example
 *   asOpenRouterToolName({ slug: 'weather.lookup' })  // 'weather_lookup'
 */
export const asOpenRouterToolName = (input: { slug: string }): string =>
  input.slug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
