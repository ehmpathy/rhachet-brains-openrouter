import { MalfunctionError } from 'helpful-errors';
import { getError } from 'test-fns';

import { asBrainPlugToolInvocationFromOpenRouter } from './asBrainPlugToolInvocationFromOpenRouter';

describe('asBrainPlugToolInvocationFromOpenRouter', () => {
  test('a tool call becomes an invocation, with its json arguments parsed', () => {
    const invocation = asBrainPlugToolInvocationFromOpenRouter({
      toolCall: {
        id: 'call-1',
        type: 'function',
        function: { name: 'getWaveReport', arguments: '{"spot":"pipeline"}' },
      },
      slugByName: { getWaveReport: 'getWaveReport' },
    });
    expect(invocation).toEqual({
      exid: 'call-1',
      slug: 'getWaveReport',
      input: { spot: 'pipeline' },
    });
  });

  // 🔴 .why = a slug with a dot is sent under a cast name; the caller's tool
  //           loop keys on the slug it plugged, so the call must carry that slug
  test('a cast function name maps back to the slug the caller plugged', () => {
    const invocation = asBrainPlugToolInvocationFromOpenRouter({
      toolCall: {
        id: 'call-3',
        type: 'function',
        function: { name: 'wave_report', arguments: '{}' },
      },
      slugByName: { wave_report: 'wave.report' },
    });
    expect(invocation.slug).toEqual('wave.report');
  });

  test('a name no plugged tool sends under is kept verbatim', () => {
    const invocation = asBrainPlugToolInvocationFromOpenRouter({
      toolCall: {
        id: 'call-4',
        type: 'function',
        function: { name: 'unknown_tool', arguments: '{}' },
      },
      slugByName: {},
    });
    expect(invocation.slug).toEqual('unknown_tool');
  });

  test('malformed arguments fail with a named error that cites the call', async () => {
    const error = await getError(async () =>
      asBrainPlugToolInvocationFromOpenRouter({
        toolCall: {
          id: 'call-2',
          type: 'function',
          function: { name: 'getWaveReport', arguments: '{"spot":"pipe' },
        },
        slugByName: { getWaveReport: 'getWaveReport' },
      }),
    );
    expect(error).toBeInstanceOf(MalfunctionError);
    expect(error.message).toContain("tool 'getWaveReport'");
    expect(error.message).toContain('no tool was run');
    expect(error.message).toMatchSnapshot();
  });
});
