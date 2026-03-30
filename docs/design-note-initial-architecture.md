# Initial Design Note

## Goals

Arceus needs to feel like a serious terminal engineering tool, not a chat wrapper. The first implementation therefore optimizes for:

1. explicit state
2. low runtime dependency count
3. provider-agnostic orchestration
4. inspectable file and git actions
5. collaboration primitives that work locally first

## Architectural choices

### Runtime stack

- TypeScript on modern Node.js
- native `fetch` for provider calls
- native `net` for live session transport
- native `fs`, `child_process`, and `readline` for repo actions and terminal interaction

This keeps the app fast to start, easy to audit, and portable across machines without a heavy UI runtime.

### Agent pipeline

The agent runtime is split into planner, executor, and reviewer phases:

- planner: builds task understanding and execution plan
- executor: produces a structured change set or summary
- reviewer: summarizes risk, validation steps, and fallback actions

Each phase can route to a different model.

### Patch flow

Rather than allowing opaque writes, the runtime produces a structured change set:

- target path
- operation type
- before content
- after content
- rendered diff

The change set is inspectable in the CLI and TUI before apply, and destructive actions remain explicit.

### Live session

Live sessions are implemented as:

- append-only JSON event log on disk
- local socket server for real-time broadcast
- deterministic derived state in memory
- file watcher events broadcast as collaboration activity

This keeps host and join behavior simple while still supporting replay and persistence.

### TUI

The TUI renders a dense dashboard in the terminal with:

- sidebar for models, participants, and repo status
- central event stream
- diff and changed-files panes
- command input and keybinding footer

The rendering model is stateless per frame and driven by the derived app state.

## First implementation scope

The codebase includes:

- a real CLI with the required commands
- config loading and initialization
- multi-provider adapter interfaces with OpenAI, Anthropic, local, and mock implementations
- repo tools for file, shell, git, search, and diff operations
- live session hosting and joining
- session persistence
- a usable terminal UI
- tests around routing, config, events, file safety, and live sessions

## Deferred depth

The following are supported with pragmatic initial implementations and clear extension points:

- advanced streaming token rendering
- fully autonomous multi-step tool calling
- direct GitHub API mutation flows
- remote multi-machine session transport beyond local socket hosting
