import { ConstraintError } from 'helpful-errors';
import OpenAI from 'openai';

/**
 * .what = builds the error that names an openrouter ACCOUNT fault, or null
 * .why = a 402 or 401 says naught about the model or the prompt; the caller's
 *        account cannot pay or cannot auth. an opaque api error hides that the
 *        fix is a credit top-up or a key swap, so name the fix
 *
 * .note = returns null when no enrichment applies, so the call site rethrows
 *         the original untouched. this never swallows an error
 *         (`rule.forbid.failhide`) — it only adds the fix to one it recognizes.
 */
export const getOneAccountError = (input: {
  error: Error;
}): ConstraintError<{
  status: number;
  cause: InstanceType<typeof OpenAI.APIError>;
}> | null => {
  // only an api error carries a status we can classify
  if (!(input.error instanceof OpenAI.APIError)) return null;

  // 402 = the account has no credits left to pay for the ask
  if (input.error.status === 402)
    return new ConstraintError(
      [
        'openrouter has no credits left on this account. please add credits.',
        '',
        'fix: top up at https://openrouter.ai/settings/credits',
        "     (and raise the key's own credit limit, if it has one: https://openrouter.ai/settings/keys)",
      ].join('\n'),
      { status: 402, cause: input.error },
    );

  // 401 = the key is absent, revoked, or wrong
  if (input.error.status === 401)
    return new ConstraintError(
      [
        'openrouter rejected the OPENROUTER_API_KEY. please check the key.',
        '',
        'fix: mint a key at https://openrouter.ai/settings/keys, then',
        '     rhx keyrack fill --owner ehmpath --env <env> --key OPENROUTER_API_KEY --refresh',
      ].join('\n'),
      { status: 401, cause: input.error },
    );

  // any other failure is not an account fault, so leave it alone
  return null;
};
