# AGENTS.md

## Project
Build **Arceus**, a terminal-native coding agent inspired by Claude Code, but explicitly multi-model and collaboration-first.

Arceus is a TUI/CLI application that:
- lets users code, edit, refactor, inspect, and run repo tasks from the terminal
- routes work across multiple models from different providers
- supports a **Live Session** mode where two or more terminals attach to the same shared session
- syncs code and session state in real time across terminals
- surfaces file changes, diffs, logs, and agent activity in the TUI
- integrates cleanly with Git and GitHub

The end product should feel like a serious developer tool, not a demo.

---

## Product Intent

Arceus should be:

- **terminal-first**
- **model-agnostic**
- **fast**
- **transparent**
- **safe with file edits**
- **good at real-world repo work**
- **collaboration-native**

Arceus should not be:
- a toy chatbot in the terminal
- a thin wrapper around one model API
- a magic black box that edits files with no visibility
- an IDE replacement with bloated GUI behavior

When making design decisions, prioritize:
1. reliability
2. clarity
3. composability
4. local-first developer ergonomics
5. clean abstractions over cleverness

---

## Core Features

### 1. Multi-model agent runtime
Arceus must support multiple providers and models, including:
- OpenAI models
- Anthropic models
- local or self-hosted models
- future providers through a common adapter interface

The system must allow:
- explicit model selection by the user
- automatic routing by task type
- fallback models
- per-agent model configuration
- different models for planning vs patch generation vs summarization

### 2. Terminal UI
The TUI should provide:
- session sidebar
- current model/provider indicator
- file tree or changed-files view
- diff viewer
- task log / event stream
- command input
- status footer
- live session state
- Git status visibility

The TUI should feel minimal, dense, and professional.

### 3. Live Session
Live Session is a first-class feature.

It must allow:
- multiple terminals to join the same session
- real-time shared event stream
- shared task context
- live file-change propagation
- awareness of who or what made a change
- conflict visibility
- optional GitHub sync behavior

A user in Terminal A should be able to make a change and see it reflected in Terminal B quickly and clearly.

### 4. Code execution and repo actions
Arceus should be able to:
- read and write files
- create files
- rename and delete files carefully
- run shell commands
- inspect command output
- run tests
- run linters
- run formatters
- stage and commit Git changes
- optionally push to GitHub when explicitly configured

### 5. GitHub integration
Arceus should support:
- branch awareness
- diff summaries
- commit generation
- optional auto-commit during live sessions
- optional PR preparation metadata
- visible sync state in the TUI

Do not hide Git operations from the user.

---

## Architecture Requirements

Use a modular architecture with clear boundaries.

Preferred top-level components:

- `cmd/` or `src/cli/`
  - CLI entrypoints
  - commands
  - argument parsing

- `src/tui/`
  - terminal UI
  - panes/views/components
  - keybindings
  - event rendering

- `src/core/`
  - shared domain models
  - task/event/session definitions
  - config schema
  - common errors

- `src/agents/`
  - agent orchestration
  - planner/executor/reviewer agents
  - routing logic
  - subagent support

- `src/providers/`
  - provider adapters
  - OpenAI adapter
  - Anthropic adapter
  - local model adapter
  - provider capability descriptors

- `src/tools/`
  - file tools
  - shell tools
  - git tools
  - search tools
  - diff tools

- `src/live/`
  - live session server/client logic
  - shared state
  - collaboration transport
  - conflict handling
  - session presence

- `src/github/`
  - GitHub integration
  - remote sync abstractions

- `src/config/`
  - project config
  - user config
  - secrets/env loading

- `src/storage/`
  - session persistence
  - logs
  - caches

- `tests/`
  - unit tests
  - integration tests
  - provider mocks
  - live session tests

If a different layout is chosen, it must still preserve these boundaries.

---

## Recommended Technical Direction

Default stack preference:
- **TypeScript**
- Node.js runtime
- terminal UI framework appropriate for robust TUI behavior
- strict typing
- modular packages where helpful

Alternative stack is acceptable only if it clearly improves terminal performance and maintainability.

Strong preference:
- TypeScript for orchestration and provider integration
- explicit interfaces
- event-driven internals
- JSON-serializable shared session events
- clean plugin/provider abstraction

Do not introduce unnecessary complexity early.

---

## Provider Abstraction Rules

All models must be accessed through a common interface.

Each provider adapter should expose:
- provider name
- model name
- capabilities
- streaming support
- tool-calling support
- max context metadata if available
- cost metadata if configured
- error normalization

Create a unified request/response shape so the rest of the app is provider-agnostic.

The routing layer should be able to choose models based on:
- task type
- repo size
- latency preference
- cost preference
- reasoning depth
- user override

Never hardcode one provider into core logic.

---

## Live Session Rules

Live Session must be treated as a system feature, not a UI hack.

Design it around explicit shared state:
- session id
- participants
- agent actions
- file changes
- terminal-originated commands
- Git actions
- timestamps
- conflict events

Preferred behavior:
- append-only event log
- derived session state from events where practical
- deterministic replay where feasible
- local persistence of session history

Support at least:
- host session
- join session
- leave session
- list participants
- inspect recent events
- broadcast edits
- sync file changes
- resolve conflicts visibly

All live session changes must be inspectable in the TUI.

---

## Git and File Safety Rules

Never make destructive file operations silently.

Before risky actions:
- show intent
- show affected files
- ask for confirmation if action is destructive or broad

Destructive actions include:
- delete file
- recursive rewrite
- large-scale rename
- force checkout
- reset
- push with overwrite semantics

Always preserve diffs where possible.

Prefer:
1. generate patch
2. show diff
3. apply change
4. validate
5. summarize result

---

## UX Requirements

The UX should feel like a serious terminal engineering tool.

Tone:
- direct
- concise
- technical
- no hype language
- no anthropomorphic fluff

Design principles:
- dense but readable
- keyboard-first
- strong defaults
- visible state
- low cognitive overhead

Every important state transition should be visible:
- model switched
- file modified
- command started
- command completed
- test failed
- test passed
- session participant joined
- git sync completed
- merge conflict detected

---
# Features List

- CLI bootstrap
- local config
- TUI shell
- provider abstraction
- OpenAI + Anthropic adapters
- file read/write tools
- shell command execution
- diff rendering
- chat/task loop
- model routing
- patch application flow
- test/lint/format command hooks
- git status integration
- commit generation
- repo-aware context gathering
- Live Session transport
- multi-terminal session join/host
- shared event stream
- shared file change visibility
- participant presence
- GitHub sync features
- better conflict handling
- session persistence
- subagents for planner/executor/reviewer
- provider fallback and reliability improvements

---

## Commands to Support

At minimum, design for commands like:

- `arceus`
- `arceus chat`
- `arceus run`
- `arceus models list`
- `arceus models use`
- `arceus session host`
- `arceus session join`
- `arceus session status`
- `arceus diff`
- `arceus git status`
- `arceus config init`

Then also add various other commands, like claude code has.

---

## Config Requirements

Support both:
- global user config
- per-project config

Config should include:
- default provider
- default model
- routing preferences
- API keys via env
- live session defaults
- git behavior
- GitHub integration options
- UI preferences
- safety settings

Use a documented config file format.

Example categories:
- `models`
- `routing`
- `live`
- `git`
- `github`
- `ui`
- `tools`

Do not commit secrets.

---

## Testing Requirements

Every non-trivial feature should be testable.

Required test coverage areas:
- provider adapters
- routing logic
- patch generation/application flow
- file safety checks
- git integration helpers
- live session state sync
- event serialization/deserialization
- config parsing
- command handling

Use mocks/fakes for model providers and GitHub interactions.

Add integration tests for:
- multi-file edit task
- test/lint loop
- live session with two clients
- git commit flow

---

## Coding Standards

- Use strict typing.
- Keep functions small and specific.
- Prefer explicit interfaces over implicit object shapes.
- Avoid giant classes.
- Avoid tightly coupled provider logic.
- Avoid hidden globals.
- Write code that a second engineer can extend safely.

When implementing new code:
- explain the design in comments only where needed
- avoid noisy comments
- prefer readable names
- keep modules cohesive

---

## Agent Behavior Instructions

When working in this repository, always:

1. understand the relevant architecture before editing
2. preserve provider-agnostic design
3. avoid shortcuts that lock Arceus to a single vendor
4. prefer incremental, reviewable changes
5. keep terminal UX clean and legible
6. keep live collaboration logic explicit
7. add or update tests with meaningful changes
8. update docs when behavior changes
9. summarize what changed and what remains

Before implementing a feature:
- identify which layer it belongs to
- identify what interfaces are required
- identify failure cases
- identify what the user will see in the TUI

---

## Planning Instructions

For medium or large tasks:
- create a short implementation plan first
- break work into concrete steps
- state assumptions
- identify files likely to change
- then implement

For very large features:
- create a design note in the repo before coding
- keep the design note practical and implementation-oriented

Do not jump into editing without a plan if the task affects:
- provider abstraction
- routing
- live session state
- git behavior
- TUI architecture

---

## Documentation Requirements

Maintain documentation for:
- architecture overview
- config reference
- provider integration
- live session behavior
- command reference
- development setup

When building major features, update docs in the same change.

---

## Definition of Done

A task is only done if:
- code is implemented cleanly
- tests pass or test gaps are explicitly called out
- docs are updated if needed
- behavior is visible and understandable to the user
- no architecture rule above is violated

---

## Non-Goals

Do not drift into:
- full GUI desktop app work
- browser-first workflow
- vague AI productivity features unrelated to coding
- social collaboration layers beyond shared coding sessions
- hidden autonomous behavior without user visibility

Arceus is a coding agent for the terminal.