# brain.atom vs brain.repl

## .what

two distinct interfaces for llm interaction:

| interface  | purpose                                 | api                         |
| ---------- | --------------------------------------- | --------------------------- |
| brain.atom | raw model access, single inference call | xAI Chat Completions API    |
| brain.repl | agentic loop with tool use and sandbox  | (not yet available for xAI) |

## .why

- **atom** = the atomic unit of llm interaction
  - one api call, one response
  - stateless, no memory of prior calls
  - supports all models (grok-4, grok-code-fast-1, etc.)

- **repl** = read, execute, print, loop
  - leverages atoms within a loop to enable multistep thought and action
  - orchestrates multiple atom calls with tool execution between steps
  - provides sandboxed execution (read-only or workspace-write)
  - **note**: xAI does not yet offer a repl sdk, but we expect this will change soon

## .key relationship

repls are built on top of atoms:

```
repl.ask(prompt)
  └── loop until done:
        ├── atom.ask(prompt) → thought
        ├── execute tools based on thought
        └── feed results back into next atom call
```

the repl is not a different model — it's an orchestration layer that invokes the same base atom repeatedly, with tool results injected between calls.

## .architecture

```
brain.atom (xAI Chat Completions API)
├── grok-4, grok-4-fast-reasoning, grok-4-fast-non-reasoning
├── grok-4.1-fast-reasoning, grok-4.1-fast-non-reasoning
├── grok-3, grok-3-mini
└── grok-code-fast-1

brain.repl (future)
├── wraps atom with agentic loop
├── sandbox modes: read-only, workspace-write
└── reuses atom specs (no duplicate declarations)
```

## .current state

today this package provides:
- **brain.atom** via `genBrainAtom()` - full support for all grok models
- **brain.repl** - not yet available (xAI has not released a repl sdk)

when xAI releases an agentic sdk (similar to openai codex or claude code), this package will add repl support via the same config pattern.

## .refs

- xAI api docs: https://docs.x.ai/docs
- xAI models: https://docs.x.ai/docs/models
- grok-code-fast-1: https://x.ai/news/grok-code-fast-1
- grok-4: https://x.ai/news/grok-4
