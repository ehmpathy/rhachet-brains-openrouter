# brain.atom vs brain.repl

## .what

two interfaces for llm interaction:

| interface  | purpose                                 | this package               |
| ---------- | --------------------------------------- | -------------------------- |
| brain.atom | one inference call, one response        | ✔ openrouter chat completions |
| brain.repl | agentic loop with tool use and sandbox  | ✘ not offered              |

## .why

- **atom** = the atomic unit of llm interaction
  - one api call, one response
  - stateless; continuation rides on `on.episode`
  - any model openrouter serves
- **repl** = read, execute, print, loop
  - calls atoms in a loop, with tool execution between steps
  - openrouter serves models, not agents, so this package offers no repl

## .the relationship

a repl is an orchestration layer over the same atom:

```
repl.ask(prompt)
  └── loop until done:
        ├── atom.ask(prompt) → thought
        ├── execute tools based on thought
        └── feed results back into next atom call
```

## .what this package provides

- **brain.atom** via `genBrainAtom({ slug })` — static slugs, pinned ids, and any openrouter id
- **route promises** in the slug's filter segment (`floor`, `speed`, `precision`, `privacy`,
  `region`, `price.max`) — each enforced per call, see `readme.md`

## .refs

- openrouter api: https://openrouter.ai/docs/api-reference/chat-completion
- openrouter models: https://openrouter.ai/models
