import { MalfunctionError } from 'helpful-errors';

/**
 * .what = GET an openrouter api path, as json
 * .why = one place for auth and the failure that names the read
 *
 * .note = a failed read is a MalfunctionError: the system, not the caller,
 *         must recover, and no unfiltered call is ever sent in its place (case=11)
 * .note = the body is `unknown`; each read checks it against its own schema
 * .note = a network fault and an unparseable body are wrapped as that same
 *         MalfunctionError, with the cause kept. so every expected read failure
 *         carries one class, and a catch can allowlist it (F25)
 */
export const getOneOpenRouterJson = async (input: {
  path: string;
  apiKey: string;
}): Promise<unknown> => {
  // reach openrouter; a network fault names the read it broke
  const response = await MalfunctionError.wrap(
    () =>
      fetch(`https://openrouter.ai/api/v1${input.path}`, {
        headers: { Authorization: `Bearer ${input.apiKey}` },
      }),
    {
      message: `openrouter read failed: GET ${input.path} never reached openrouter. no promise could be checked, so no call was sent. a retry is safe.`,
      metadata: { path: input.path },
    },
  )();

  // a refused read names its status and body
  if (!response.ok)
    throw new MalfunctionError(
      `openrouter read failed: GET ${input.path} → ${response.status}. no promise could be checked, so no call was sent. a retry is safe.`,
      {
        path: input.path,
        status: response.status,
        body: await response.text(),
      },
    );

  // an unparseable body names the read it came from
  return MalfunctionError.wrap(() => response.json(), {
    message: `openrouter read failed: GET ${input.path} answered a body that is not json. no promise could be checked, so no call was sent. a retry is safe.`,
    metadata: { path: input.path, status: response.status },
  })();
};
