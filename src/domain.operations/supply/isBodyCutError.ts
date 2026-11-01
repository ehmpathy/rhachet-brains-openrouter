import OpenAI from 'openai';

/**
 * .what = whether a socket died mid-body, per undici's own signal
 * .why = undici raises `TypeError: terminated`, or a cause coded
 *        `UND_ERR_SOCKET`, when the host drops the socket before the body ends
 *
 * .note = read by name, never `instanceof`: node's built-in fetch raises its errors
 *         in node's own realm, so a `TypeError` from it fails `instanceof TypeError`
 *         in any other realm (a jest vm, an embedded host). proven on a real socket
 *         in `getOneFloorCompletion.socket.integration`
 */
const isSocketDeath = (input: { error: unknown }): boolean => {
  const { error } = input;
  if (typeof error !== 'object' || error === null) return false;
  const isTerminated =
    'name' in error &&
    error.name === 'TypeError' &&
    'message' in error &&
    error.message === 'terminated';
  if (isTerminated) return true;
  const cause = 'cause' in error ? error.cause : null;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === 'UND_ERR_SOCKET'
  );
};

/**
 * .what = whether an error is a host that cut its reply body short
 * .why = a body cut shows in three shapes: a SyntaxError from the sdk's json
 *        parse, undici's raw socket death mid-body, and an sdk
 *        `APIConnectionError` whose cause is that same socket death. all three
 *        are a host fault the walk can step past
 *
 * .note = measured 2026-10-14 on this route: `TypeError: terminated`, cause
 *         `UND_ERR_SOCKET`, after 1665 bytes read
 */
export const isBodyCutError = (input: { error: unknown }): boolean => {
  // the parse of a body that ends mid-json
  if (input.error instanceof SyntaxError) return true;

  // the socket died mid-body, raw
  if (isSocketDeath({ error: input.error })) return true;

  // the socket died mid-body, wrapped by the sdk
  if (!(input.error instanceof OpenAI.APIConnectionError)) return false;
  if (input.error instanceof OpenAI.APIConnectionTimeoutError) return false;
  return isSocketDeath({
    error: 'cause' in input.error ? input.error.cause : null,
  });
};
