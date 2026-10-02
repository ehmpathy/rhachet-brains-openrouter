import { MalfunctionError } from 'helpful-errors';
import type { z } from 'zod';

/**
 * .what = an openrouter reply body, checked against the shape this package reads
 * .why = each read feeds a supply promise (price, speed, privacy, retirement); a
 *        drifted field must fail loud at the boundary, never pass the compiler as
 *        `any` and misroute an ask in silence
 */
export const asOpenRouterBodyChecked = <TShape>(input: {
  body: unknown;
  schema: z.ZodType<TShape>;
  read: string; // the api path, so the error names which read drifted
}): TShape => {
  // a body that fits is returned as its shape
  const parsed = input.schema.safeParse(input.body);
  if (parsed.success) return parsed.data;

  // a drifted body names the read and each field that drifted
  throw new MalfunctionError(
    `openrouter's ${input.read} reply drifted from the shape this package reads. no promise could be checked, so no call was sent.`,
    {
      read: input.read,
      issues: parsed.error.issues.map(
        (issue) =>
          `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`,
      ),
      hint: 'openrouter changed its api; update the schema in this package',
    },
  );
};
