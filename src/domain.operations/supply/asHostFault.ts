import OpenAI from 'openai';

import type { HostFault } from '../../domain.objects/HostFault';
import { HostFaultError } from '../../domain.objects/HostFaultError';
import { isReplyEmptyWhereJsonOwed } from './isReplyEmptyWhereJsonOwed';
import { isReplyFailed } from './isReplyFailed';
import { isReplyJsonIgnored } from './isReplyJsonIgnored';

/**
 * .what = the marker openrouter puts on an error a host returned
 * .why = a host 400 may arrive with or without `metadata.provider_name`;
 *        this message alone says the host, not the caller, failed
 */
const PROVIDER_ERROR_MESSAGE = 'Provider returned error';

/**
 * .what = the gateway statuses that name an upstream host down
 * .why = issue #12 measured 502 and 504 from one upstream while healthy hosts sat next.
 *        a bare 500 is not among them: it may be openrouter's own fault, which no other
 *        host cures, so it rethrows untouched, as 0.1.3
 */
const STATUSES_GATEWAY_FAILED: number[] = [502, 503, 504];

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
 * .what = the outcome a whole reply's shape names, if any
 * .why = the reply half of the decision; prose and empty read only a whole `stop`
 *        reply, so they run before the mid-reply failure check
 */
const asReplyFault = (input: {
  response: OpenAI.ChatCompletion;
  expectsJson: boolean;
}): HostFault | null => {
  if (isReplyJsonIgnored(input)) return 'prose';
  if (isReplyEmptyWhereJsonOwed(input)) return 'empty';
  if (isReplyFailed(input)) return 'failed';
  return null;
};

/**
 * .what = the outcome a status code names, given whether a host was marked
 * .why = the status half of the decision, apart from the name and marker reads
 */
const asStatusFault = (input: {
  status: number | undefined;
  isHostMarked: boolean;
}): HostFault | null => {
  // a throttle or an unreachable host is always the host's
  if (input.status === 429) return 'throttled';
  if (input.status === 404) return 'refused';

  // a 400 is the host's only when openrouter marks it so
  if (input.status === 400 && input.isHostMarked) return 'failed';

  // a gateway status is the admitted host down (issue #12)
  if (STATUSES_GATEWAY_FAILED.includes(input.status ?? 0)) return 'failed';

  // all else is not a host fault
  return null;
};

/**
 * .what = whether an error, or a whole reply, is the fault of one host, and how
 * .why = THE one decision of "did this host fail", so the floor walk and the
 *        admitted set never disagree on which reply counts as a host fault. a
 *        host fault is local to that host: another may serve. all else is the
 *        caller's, untouched
 *
 * .note = three clause families: reply (prose, empty, failed), transport (body-cut,
 *         stalled), and status (429, 404, a marked 400, 502|503|504). a 400 that
 *         openrouter marks neither by `provider_name` nor by `Provider returned error`
 *         is the caller's own fault; a bare 500 rethrows, as 0.1.3. a new clause
 *         lands here, never at a call site
 * .note = `isHostMarked` says openrouter attributed the fault to a host, by name
 *         or by marker. a 429 or 404 with neither is openrouter's own answer
 *         (its account limit, a withdrawn model), which no other host can fix.
 *         a whole reply came from a host, so it is marked; a transport fault is
 *         not, since openrouter named no host
 * .note = a reply cut at the output limit is never a host fault: the next host
 *         would spend the same thought again
 * .note = the reply checks run prose → empty → failed: only a whole `stop` reply is
 *         prose or empty, and neither is `error`
 */
export const asHostFault = (
  input:
    | { error: unknown }
    | { response: OpenAI.ChatCompletion; expectsJson: boolean },
): {
  outcome: HostFault;
  providerName: string | null;
  isHostMarked: boolean;
} | null => {
  // a whole reply: read its shape
  if ('response' in input) {
    const outcome = asReplyFault(input);
    return outcome ? { outcome, providerName: null, isHostMarked: true } : null;
  }

  // transport: the body was cut, or never arrived inside the bound
  if (input.error instanceof HostFaultError)
    return {
      outcome: input.error.fault,
      providerName: null,
      isHostMarked: false,
    };

  // status: only an api error carries one
  if (!(input.error instanceof OpenAI.APIError)) return null;
  const body: unknown = input.error.error;
  const providerName = asProviderName({ body });
  const isHostMarked = providerName !== null || isProviderErrorMarked({ body });
  const outcome = asStatusFault({ status: input.error.status, isHostMarked });
  return outcome ? { outcome, providerName, isHostMarked } : null;
};
