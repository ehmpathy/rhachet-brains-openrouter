# brain config pattern

## .what

standardized pattern for brain atom configuration:

| file | export | purpose |
|------|--------|---------|
| `BrainAtom.config.ts` | `CONFIG_BY_ATOM_SLUG` | maps atom slugs to model configs |

## .why

- **single source of truth** — specs declared once in atom config
- **type safety** — slug types enforce valid mappings at compile time
- **future ready** — when xAI releases a repl sdk, specs can be reused

## .structure

### atom config (`BrainAtom.config.ts`)

```ts
export type XaiBrainAtomSlug =
  | 'xai/grok/code-fast-1'
  | 'xai/grok/3'
  | 'xai/grok/3-mini'
  | 'xai/grok/4'
  | 'xai/grok/4-fast-wout-reason'
  | 'xai/grok/4-fast-with-reason'
  | 'xai/grok/4.1-fast-wout-reason'
  | 'xai/grok/4.1-fast-with-reason';

export type BrainAtomConfig = {
  model: string;
  description: string;
  spec: BrainSpec;
};

export const CONFIG_BY_ATOM_SLUG: Record<XaiBrainAtomSlug, BrainAtomConfig> = {
  'xai/grok/code-fast-1': {
    model: 'grok-code-fast-1',
    description: 'grok-code-fast-1 - optimized for agentic code (256K)',
    spec: { ... },
  },
  // ...
};
```

### future repl config (`BrainRepl.config.ts`)

when xAI releases a repl sdk, this package will add:

```ts
import {
  type BrainAtomConfig,
  CONFIG_BY_ATOM_SLUG,
} from './BrainAtom.config';

export type XaiBrainReplSlug =
  | 'xai/grok-code'
  | 'xai/grok-code/fast';

/**
 * .what = repl config by slug
 * .why = maps repl slugs to atom configs (reuses specs from CONFIG_BY_ATOM_SLUG)
 */
export const CONFIG_BY_REPL_SLUG: Record<XaiBrainReplSlug, BrainAtomConfig> = {
  'xai/grok-code': CONFIG_BY_ATOM_SLUG['xai/grok/code-fast-1'],
  'xai/grok-code/fast': CONFIG_BY_ATOM_SLUG['xai/grok/code-fast-1'],
};
```

## .slug conventions

### atom slugs (explicit)

format: `{repo}/{family}/{model}/{version?}`

examples:
- `xai/grok/code-fast-1`
- `xai/grok/3`
- `xai/grok/3-mini`
- `xai/grok/4`
- `xai/grok/4-fast-wout-reason`
- `xai/grok/4-fast-with-reason`

### repl slugs (aliases) — future

format: `{repo}/{capability}/{variant?}`

examples:
- `xai/grok-code` → default grok code model
- `xai/grok-code/fast` → fast variant

## .key insight

repl slugs are **aliases** that map to **explicit atom slugs**:

```ts
// repl slug → atom slug → config
'xai/grok-code' → 'xai/grok/code-fast-1' → { model, description, spec }
```

this enables:
- simpler repl slugs for common use cases
- explicit atom slugs for precise model selection
- shared specs between atoms and repls (no duplication)

## .name conventions

| constant | scope | content |
|----------|-------|---------|
| `CONFIG_BY_ATOM_SLUG` | atom file | atom slug → config |
| `CONFIG_BY_REPL_SLUG` | repl file (future) | repl slug → atom config |
| `XaiBrainAtomSlug` | type | union of valid atom slugs |
| `XaiBrainReplSlug` | type (future) | union of valid repl slugs |
| `BrainAtomConfig` | type | shape of config object |
