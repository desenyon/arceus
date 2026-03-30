# Arceus

Arceus is a terminal-native coding agent built for real repository work, multi-model orchestration, and live multi-terminal collaboration.

## What ships here

- strict TypeScript architecture with clean boundaries
- provider-agnostic agent runtime
- file, diff, shell, search, and git tooling
- a dense keyboard-first TUI
- append-only live session transport over local sockets
- project and global config loading
- session persistence and replay
- docs for architecture, providers, commands, config, and live sessions

## Quick start

```bash
npm install
npm run build
node dist/cli/index.js config init
node dist/cli/index.js
```

## Core commands

```bash
arceus
arceus chat
arceus run "summarize the repo"
arceus run "implement a healthcheck" --mode patch --apply
arceus test
arceus lint
arceus format
arceus models list
arceus models use openai:gpt-5-mini
arceus session host
arceus session join <session-id>
arceus session list
arceus session status
arceus diff
arceus git status
arceus git stage
arceus git commit --message "feat: ship it"
arceus config init
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Config reference](./docs/config.md)
- [Providers](./docs/providers.md)
- [Live sessions](./docs/live-sessions.md)
- [Command reference](./docs/commands.md)
- [Initial design note](./docs/design-note-initial-architecture.md)
