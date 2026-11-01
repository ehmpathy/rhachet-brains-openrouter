import type { HostFault } from '../../domain.objects/HostFault';
import type { SdkOpenRouterEndpoints } from './sdkOpenRouterEndpoints';

/**
 * .what = what each host fault proves about the cache
 * .why = a refusal proves the cached endpoint list stale, so it is dropped; a prose
 *        or empty reply where json was owed proves the host breaks the schema promise,
 *        so json asks skip it on this machine for 7 days. every other fault proves
 *        naught beyond this ask
 *
 * .note = a Record, so a new fault kind cannot compile until its cache proof is named
 */
const CACHE_PROOF_BY_FAULT: Record<
  HostFault,
  'stale-list' | 'json-ignored' | 'none'
> = {
  refused: 'stale-list',
  prose: 'json-ignored',
  empty: 'json-ignored',
  throttled: 'none',
  failed: 'none',
  'body-cut': 'none',
  stalled: 'none',
};

/**
 * .what = records what one host fault proves about the cache
 * .why = each supply path notes a fault in one call; the proof per kind is the table above
 *
 * .note = an empty reply marks its host under a thought cap too: an empty reply steps
 *         only on `stop`, and a room spent on thought ends `length`, which never steps
 * .note = `tag` is null where no host was named (the admitted set's unnamed refusal);
 *         a json-ignored mark then has no host to mark, and is skipped
 */
export const setHostFaultNoted = async (
  input: {
    fault: HostFault;
    model: string;
    tag: string | null;
  },
  context: {
    sdkOpenRouterEndpoints: Pick<
      SdkOpenRouterEndpoints,
      'delForModel' | 'setJsonIgnoredTag'
    >;
  },
): Promise<void> => {
  const proof = CACHE_PROOF_BY_FAULT[input.fault];
  if (proof === 'stale-list')
    return context.sdkOpenRouterEndpoints.delForModel({ model: input.model });
  if (proof === 'json-ignored' && input.tag !== null)
    return context.sdkOpenRouterEndpoints.setJsonIgnoredTag({
      model: input.model,
      tag: input.tag,
    });
};
