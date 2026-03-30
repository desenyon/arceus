# Architecture Overview

## Layers

### `src/cli`

CLI entrypoints, argument parsing, and command dispatch.

### `src/tui`

Terminal rendering, keyboard handling, pane composition, and interactive command loop.

### `src/core`

Shared types, events, config models, session derivation, and common errors.

### `src/agents`

Planner, executor, reviewer orchestration and routing.

### `src/providers`

Provider-agnostic request/response interfaces and adapter implementations.

### `src/tools`

File, diff, git, shell, and search primitives.

### `src/live`

Socket transport, event replication, presence, snapshots, and file watch broadcast.

### `src/github`

GitHub-adjacent sync metadata and PR preparation helpers.

### `src/config`

Global and project config resolution plus defaults.

### `src/storage`

Session logs, descriptors, and cache persistence.

## Core runtime flow

1. CLI or TUI collects a task request.
2. Config resolver picks defaults and routing policy.
3. Router selects model profiles for planner, executor, and reviewer.
4. Runtime gathers repo context.
5. Provider adapter returns either a summary or structured change proposal.
6. Diff tool renders the proposal.
7. File tool validates and applies if approved.
8. Session store appends events for replay and live broadcast.

## State model

Arceus treats collaboration and visibility as first-class concerns. Important actions are recorded as typed session events. Session UI state is derived from events rather than spread across hidden globals.
