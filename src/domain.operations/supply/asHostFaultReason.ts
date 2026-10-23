import OpenAI from 'openai';

/**
 * .what = the host's own words for a fault, from openrouter's error body
 * .why = openrouter marks a host's error `Provider returned error` and keeps the
 *        host's reason in `metadata.raw`. a host can reject the caller's own
 *        request (a prompt over its context window), so the exhausted error must
 *        show that reason, or the caller is told to retry what can never serve
 *
 * .note = `raw` is often the host's json (`{"error":{"message":"…"}}`); its inner
 *         message is read. json with no message is no reason; text that is not
 *         json is read as written; with no `raw`, the body's own message is read
 * .note = cut to 300 chars: a host may echo a whole prompt back
 */
export const asHostFaultReason = (input: { error: unknown }): string | null => {
  if (!(input.error instanceof OpenAI.APIError)) return null;
  const body: unknown = input.error.error;
  if (typeof body !== 'object' || body === null) return null;

  // the host's reason, kept raw by openrouter; else the body's own message
  const raw = asMetadataRaw({ body });
  const reason =
    raw !== null
      ? asRawReason({ raw })
      : 'message' in body && typeof body.message === 'string'
        ? body.message
        : null;
  if (!reason?.trim()) return null;
  return reason.trim().slice(0, 300);
};

/**
 * .what = the reason inside a host's `raw` text
 * .why = json that parses is read for its `error.message` alone; json with no
 *        message (`{}`, `{"error":{}}`) holds no reason, so none is shown.
 *        text that is not json is the reason as written
 */
const asRawReason = (input: { raw: string }): string | null => {
  const parsed = asJsonOrNull({ text: input.raw });
  if (parsed === null) return input.raw;
  return asJsonErrorMessage({ json: parsed });
};

/**
 * .what = the `metadata.raw` text of an openrouter error body, if any
 * .why = narrows the unknown body without a cast
 */
const asMetadataRaw = (input: { body: object }): string | null => {
  if (!('metadata' in input.body)) return null;
  const metadata: unknown = input.body.metadata;
  if (typeof metadata !== 'object' || metadata === null) return null;
  if (!('raw' in metadata) || typeof metadata.raw !== 'string') return null;
  return metadata.raw;
};

/**
 * .what = a json object parsed from text, or null when the text is not one
 * .why = a host's `raw` is json for most hosts and plain text for some
 *
 * .note = text that is not json is not an error here: the caller reads it as text
 */
const asJsonOrNull = (input: { text: string }): object | null => {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(input.text);
    } catch (error) {
      if (error instanceof SyntaxError) return null; // not json: the caller reads the text
      throw error;
    }
  })();
  if (typeof parsed !== 'object' || parsed === null) return null;
  return parsed;
};

/**
 * .what = the `error.message` inside a host's parsed json error, if any
 * .why = most hosts answer `{"error":{"message":"…"}}`; the message is the reason
 */
const asJsonErrorMessage = (input: { json: object }): string | null => {
  if (!('error' in input.json)) return null;
  const inner: unknown = input.json.error;
  if (typeof inner !== 'object' || inner === null) return null;
  if (!('message' in inner) || typeof inner.message !== 'string') return null;
  return inner.message;
};
