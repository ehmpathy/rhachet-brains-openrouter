# handoff: standardize brain supplier credential contract

## .what

standardize the `BrainSupplies*.creds` pattern across all brain suppliers to support both keyrack shorthand and explicit getter.

## .context

### current state

**fireworks** (this repo) — richer pattern:
```ts
export type BrainSuppliesFireworks = {
  creds:
    | { keyrack: { owner: string; env: string } }
    | (() => Promise<{ FIREWORKS_API_KEY: string }>);
};
```

**xai** — simpler pattern (getter only):
```ts
export type BrainSuppliesXai = {
  creds: () => Promise<{ XAI_API_KEY: string }>;
};
```

### desired state

all brain suppliers should support the same credential patterns:

```ts
export type BrainSuppliesCreds<TKeys extends Record<string, string>> =
  | { keyrack: { owner: string; env: string } }
  | (() => Promise<TKeys>);

// usage in brain supplier:
export type BrainSuppliesXai = {
  creds: BrainSuppliesCreds<{ XAI_API_KEY: string }>;
};

export type BrainSuppliesFireworks = {
  creds: BrainSuppliesCreds<{ FIREWORKS_API_KEY: string }>;
};
```

## .why

| benefit | description |
|---------|-------------|
| **consistency** | same pattern across all brain suppliers |
| **ergonomics** | keyrack shorthand eliminates boilerplate |
| **flexibility** | getter still available for custom credential sources |
| **multi-tenant** | keyrack supports owner/env switching |

## .what rhachet needs to export

### 1. standard creds type

export a generic type for credential patterns:

```ts
// src/domain.objects/BrainSuppliesCreds.ts

/**
 * .what = standard credential pattern for brain suppliers
 * .why = enables keyrack shorthand or explicit getter across all suppliers
 */
export type BrainSuppliesCreds<TKeys extends Record<string, string>> =
  | { keyrack: { owner: string; env: string } }
  | (() => Promise<TKeys>);
```

### 2. standard getSdkCreds helper

export a generic helper that looks up credentials:

```ts
// src/domain.operations/creds/getSdkCredsFromSupplier.ts

import { BadRequestError } from 'helpful-errors';
import { keyrack } from 'rhachet/keyrack';
import type { BrainSuppliesCreds } from '@src/domain.objects/BrainSuppliesCreds';

/**
 * .what = lookup credentials from brain supplier context
 * .why = standardizes credential lookup across all brain suppliers
 *
 * .patterns:
 *   1. keyrack shorthand — auto-discovers keys from keyrack
 *   2. explicit getter — custom credential source (vault, kms, db)
 *   3. env fallback — process.env lookup
 */
export const getSdkCredsFromSupplier = async <
  TKeys extends Record<string, string>,
>(input: {
  creds: BrainSuppliesCreds<TKeys> | undefined;
  keys: (keyof TKeys)[];
  envPrefix?: string; // e.g., 'FIREWORKS' for FIREWORKS_API_KEY
}): Promise<TKeys> => {
  const { creds, keys, envPrefix } = input;

  // supplier provided: lookup creds
  if (creds) {
    // keyrack shorthand
    if (typeof creds === 'object' && 'keyrack' in creds) {
      const result: Partial<TKeys> = {};
      for (const key of keys) {
        const keyStr = String(key);
        const keyResult = await keyrack.get({
          for: { key: keyStr },
          owner: creds.keyrack.owner,
          env: creds.keyrack.env,
        });

        if (keyResult.attempt.status !== 'granted') {
          throw new BadRequestError(
            `${keyStr} keyrack ${keyResult.attempt.status}`,
            {
              owner: creds.keyrack.owner,
              env: creds.keyrack.env,
              status: keyResult.attempt.status,
              ...(keyResult.attempt.status === 'absent' ||
              keyResult.attempt.status === 'locked'
                ? { message: keyResult.attempt.message, fix: keyResult.attempt.fix }
                : {}),
              ...(keyResult.attempt.status === 'blocked'
                ? { reasons: keyResult.attempt.reasons, fix: keyResult.attempt.fix }
                : {}),
            },
          );
        }
        (result as Record<string, string>)[keyStr] = keyResult.attempt.grant.key.secret;
      }
      return result as TKeys;
    }

    // explicit getter
    if (typeof creds === 'function') {
      const result = await creds();
      return result;
    }
  }

  // fallback to env vars
  const result: Partial<TKeys> = {};
  for (const key of keys) {
    const keyStr = String(key);
    const value = process.env[keyStr];
    if (!value) {
      throw new BadRequestError(
        `${keyStr} required — provide via context or env`,
      );
    }
    (result as Record<string, string>)[keyStr] = value;
  }
  return result as TKeys;
};
```

### 3. export from contract/sdk

```ts
// src/contract/sdk.ts (add exports)
export type { BrainSuppliesCreds } from '@src/domain.objects/BrainSuppliesCreds';
export { getSdkCredsFromSupplier } from '@src/domain.operations/creds/getSdkCredsFromSupplier';
```

## .what brain suppliers need to do

### xai — update to match fireworks pattern

**before**:
```ts
export type BrainSuppliesXai = {
  creds: () => Promise<{ XAI_API_KEY: string }>;
};
```

**after**:
```ts
import type { BrainSuppliesCreds } from 'rhachet';

export type BrainSuppliesXai = {
  creds: BrainSuppliesCreds<{ XAI_API_KEY: string }>;
};
```

**and update getSdkXaiCreds.ts**:
```ts
import { getSdkCredsFromSupplier } from 'rhachet';

export const getSdkXaiCreds = async (
  input: Empty,
  context?: ContextBrainSupplierXai,
): Promise<{ XAI_API_KEY: string }> => {
  const supplier = context?.['brain.supplier.xai'];
  return getSdkCredsFromSupplier({
    creds: supplier?.creds,
    keys: ['XAI_API_KEY'],
  });
};
```

### fireworks — use rhachet helper (optional, already works)

fireworks can optionally refactor to use the shared helper:

```ts
import { getSdkCredsFromSupplier } from 'rhachet';

export const getSdkFireworksCreds = async (
  input: Empty,
  context?: ContextBrainSupplierFireworks,
): Promise<{ FIREWORKS_API_KEY: string }> => {
  const supplier = context?.['brain.supplier.fireworks'];
  return getSdkCredsFromSupplier({
    creds: supplier?.creds,
    keys: ['FIREWORKS_API_KEY'],
  });
};
```

## .usage examples

### keyrack shorthand (recommended for ehmpathy internal)

```ts
import { genBrainAtom } from 'rhachet-brains-fireworksai';
import { genContextBrainSupplier } from 'rhachet';

const context = genContextBrainSupplier('fireworks', {
  creds: { keyrack: { owner: 'ehmpath', env: 'prod' } },
});

const atom = genBrainAtom({ slug: 'fireworks/deepseek/v4-flash' });
const output = await atom.ask({ prompt: 'hello', ... }, context);
```

### explicit getter (for custom credential sources)

```ts
import { genBrainAtom } from 'rhachet-brains-fireworksai';
import { genContextBrainSupplier } from 'rhachet';

const context = genContextBrainSupplier('fireworks', {
  creds: async () => ({
    FIREWORKS_API_KEY: await myVault.get('fireworks-api-key'),
  }),
});

const atom = genBrainAtom({ slug: 'fireworks/deepseek/v4-flash' });
const output = await atom.ask({ prompt: 'hello', ... }, context);
```

### env fallback (for simple cases / CI)

```ts
import { genBrainAtom } from 'rhachet-brains-fireworksai';

// no context needed — falls back to process.env.FIREWORKS_API_KEY
const atom = genBrainAtom({ slug: 'fireworks/deepseek/v4-flash' });
const output = await atom.ask({ prompt: 'hello', ... });
```

## .affected repos

| repo | action |
|------|--------|
| `rhachet` | export `BrainSuppliesCreds` type and `getSdkCredsFromSupplier` helper |
| `rhachet-brains-xai` | update `BrainSuppliesXai` type to use keyrack shorthand union |
| `rhachet-brains-fireworksai` | (already has pattern) optionally refactor to use shared helper |
| `rhachet-brains-anthropic` | update if extant |
| `rhachet-brains-openai` | update if extant |

## .priority

1. **rhachet** — export shared type + helper (foundation)
2. **rhachet-brains-xai** — adopt keyrack shorthand pattern
3. **other brain suppliers** — adopt pattern

## .notes

- keyrack shorthand requires `rhachet/keyrack` to be available
- the keyrack result has rich status handling (granted, locked, absent, blocked)
- env fallback ensures backwards compat with extant CI/test setups
