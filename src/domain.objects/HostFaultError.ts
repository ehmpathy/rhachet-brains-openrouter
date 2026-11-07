import { MalfunctionError } from 'helpful-errors';
import { asDurationInWords, type IsoDuration } from 'iso-time';

/**
 * .what = how one call to openrouter broke in transit, before any reply could be read
 * .why = a body that ends mid-json, or a call with no whole body inside its bound,
 *        is a host that did not serve. the floor walk steps past it; an ask with no
 *        next hop sees it named, never a raw SyntaxError or a hang
 *
 * .note = body-cut = the reply body ended mid-json; stalled = no whole body arrived
 *         inside the per-hop bound, body included
 */
export type HostFaultTransport = 'body-cut' | 'stalled';

/**
 * .what = the error a transport host fault raises
 * .why = the walk reads `fault` to step past; a caller reads the hosts and the bound
 */
export class HostFaultError extends MalfunctionError {
  public readonly fault: HostFaultTransport;

  constructor(input: {
    fault: HostFaultTransport;
    tags: string[];
    bound: IsoDuration;
  }) {
    super(
      [
        input.fault === 'body-cut'
          ? `openrouter's host ended its reply body mid-json; no reply could be read`
          : `openrouter's host sent no whole reply inside ${asDurationInWords(input.bound)}`,
        '',
        input.fault === 'stalled'
          ? "fix: add 'floor' to the slug's filters, so the walk steps past a dead host; if answers are slow rather than dead, cap thought (effort on the ask)"
          : "fix: add 'floor' to the slug's filters, so the walk steps past a faulted host, or retry",
      ].join('\n'),
      {
        fault: input.fault,
        tags: input.tags,
        bound: input.bound,
        hint:
          input.fault === 'stalled'
            ? 'a dead host is bounded here; a slow answer is bounded by a thought cap (effort on the ask)'
            : 'a transport fault on one host; another host may serve',
      },
    );
    this.fault = input.fault;
  }
}
