import OpenAI from 'openai';

/**
 * .what = the marker openrouter puts on an error a host returned
 * .why = a host 400 may arrive with or without `metadata.provider_name`;
 *        this message alone says the host, not the caller, failed
 */
const PROVIDER_ERROR_MESSAGE = 'Provider returned error';

/**
 * .what = the host openrouter names on a provider error, if any
 * .why = the admitted set admits many hosts at once; only this name says which
 *        one faulted, so only it can be dropped
 *
 * .note = the body is checked at runtime, not trusted to the sdk's type
 */
const asProviderName = (input: { body: unknown }): string | null => {
  if (typeof input.body !== 'object' || input.body === null) return null;
  if (!('metadata' in input.body)) return null;
  const metadata: unknown = input.body.metadata;
  if (typeof metadata !== 'object' || metadata === null) return null;
  if (!('provider_name' in metadata)) return null;
  const name: unknown = metadata.provider_name;
  return typeof name === 'string' && name.trim() !== '' ? name : null;
};

/**
 * .what = whether a body carries openrouter's provider-error marker
 * .why = the marker alone proves a host failed, even with no host named
 */
const isProviderErrorMarked = (input: { body: unknown }): boolean =>
  typeof input.body === 'object' &&
  input.body !== null &&
  'message' in input.body &&
  input.body.message === PROVIDER_ERROR_MESSAGE;

/**
 * .what = whether an error openrouter returned is the fault of one host, and how
 * .why = a host fault steps to the next host, in the floor walk and the admitted
 *        set alike; one decision, so the two paths never disagree on which
 *        reply counts as a host failure
 *
 * .note = throttled = a 429; refused = a 404, openrouter could not reach the
 *         host; failed = a 400 the host returned, marked by `provider_name` or
 *         by openrouter's `Provider returned error`. a 400 with neither is the
 *         caller's own fault and is never a host fault
 * .note = this decision owns the status-code half; a cut body and a stall (the
 *         transport half) belong here too, as rows added beside these
 * .note = `isHostMarked` says openrouter attributed the fault to a host, by name
 *         or by marker. a 429 or 404 with neither is openrouter's own answer
 *         (its account limit, a withdrawn model), which no other host can fix
 */
export const asHostFault = (input: {
  error: unknown;
}): {
  outcome: 'throttled' | 'refused' | 'failed';
  providerName: string | null;
  isHostMarked: boolean;
} | null => {
  if (!(input.error instanceof OpenAI.APIError)) return null;
  const body: unknown = input.error.error;
  const providerName = asProviderName({ body });
  const isHostMarked = providerName !== null || isProviderErrorMarked({ body });

  // a throttle or an unreachable host is always the host's
  if (input.error.status === 429)
    return { outcome: 'throttled', providerName, isHostMarked };
  if (input.error.status === 404)
    return { outcome: 'refused', providerName, isHostMarked };

  // a 400 is the host's only when openrouter marks it so
  if (input.error.status === 400 && isHostMarked)
    return { outcome: 'failed', providerName, isHostMarked };

  // all else is not a host fault
  return null;
};
