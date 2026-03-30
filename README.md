# Arceus

A terminal-native coding agent built for real repository work. Multi-model, collaboration-first, keyboard-driven.

Arceus is not a chatbot wrapper. It is a structured agent runtime with a live session layer, a provider-agnostic model interface, and a dense TUI designed for engineers who live in the terminal.

---

## Features

- **Multi-model runtime** — Anthropic, OpenAI, and local (Ollama-compatible) providers through a unified adapter interface. Per-role model routing: different models for planning, execution, and review.
- **Three-phase agent loop** — every task runs through a planner, executor, and reviewer. Patch mode produces a validated changeset with a rendered diff before any file is touched.
- **Live sessions** — multiple terminals attach to a shared session over a local TCP socket. Events, file changes, and participant state are broadcast in real time with conflict detection.
- **File safety** — destructive operations require explicit confirmation. Changesets are validated for stale content and missing files before application.
- **Provider reliability** — exponential backoff with jitter on 429/5xx responses. Configurable fallback model when the primary provider fails.
- **Git integration** — status, diff, stage, commit, and PR draft generation from the CLI and TUI.
- **Keyboard-first TUI** — three-pane layout (sidebar, event stream, inspector). PgUp/PgDn scroll. Tab toggles plan/patch mode. All errors surface in the status bar.
- **Config validation** — startup rejects misconfigured profiles, duplicate IDs, and broken model references before any work begins.

---

## Requirements

- Node.js >= 22.0.0
- An API key for at least one provider, or a running local model server

---

## Installation

```bash
git clone https://github.com/desenyon/arceus.git
cd arceus
npm install
npm run build
npm link          # optional: puts 'arceus' on your PATH
```

---

## Setup

Initialize a config file in the current project:

```bash
arceus config init
```

Or initialize globally (applies to all projects):

```bash
arceus config init --global
```

Set your API keys as environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

Set the default model:

```bash
arceus models list
arceus models use anthropic:claude-sonnet-4
```

---

## Quick start

Open the interactive TUI:

```bash
arceus
```

Run a one-shot planning task:

```bash
arceus run "explain the authentication flow in this repo"
```

Run a patch task and apply the changes:

```bash
arceus run "add request validation to the /users POST endpoint" --mode patch --apply
```

---

## Commands

### Agent

| Command | Description |
|---|---|
| `arceus` | Open the interactive TUI |
| `arceus chat` | Alias for `arceus` |
| `arceus run <task>` | Run a task in plan or patch mode |
| `arceus run <task> --mode patch --apply` | Run and apply file changes |
| `arceus run <task> --mode patch --apply --yes` | Skip destructive operation confirmation |
| `arceus run <task> --model <id>` | Override the model for this run |
| `arceus run <task> --json` | Output result as JSON |

### Dev tools

| Command | Description |
|---|---|
| `arceus test` | Run the configured test command |
| `arceus lint` | Run the configured lint command |
| `arceus format` | Run the configured format command |
| `arceus diff` | Print the current git diff |

### Git

| Command | Description |
|---|---|
| `arceus git status` | Show git status |
| `arceus git stage` | Stage all changes |
| `arceus git commit` | Commit with an auto-generated message |
| `arceus git commit --message "msg"` | Commit with a specific message |
| `arceus pr` | Print a pull request draft |
| `arceus pr --push` | Push the current branch before printing the draft |

### Models

| Command | Description |
|---|---|
| `arceus models list` | List configured model profiles |
| `arceus models use <id>` | Set the default model for the current project |
| `arceus models use <id> --global` | Set the default model globally |

### Live sessions

| Command | Description |
|---|---|
| `arceus session host` | Host a live session and open the TUI |
| `arceus session host --port 4319` | Host on a custom port |
| `arceus session join <id>` | Join an existing session |
| `arceus session list` | List saved sessions |
| `arceus session status [id]` | Inspect a session's events |
| `arceus session clean <id>` | Delete a saved session |

### Config

| Command | Description |
|---|---|
| `arceus config init` | Write default config to `.arceus/config.json` |
| `arceus config init --global` | Write default config to `~/.arceus/config.json` |
| `arceus version` | Print the installed version |

---

## TUI keybindings

| Key | Action |
|---|---|
| `Enter` | Submit prompt / run command |
| `Tab` | Toggle plan / patch mode |
| `PgDn` | Scroll inspector down |
| `PgUp` | Scroll inspector up |
| `Ctrl+C` | Quit |

### TUI slash commands

```
/mode plan|patch          switch execution mode
/view help|plan|review|changes|diff   switch inspector view
/apply                    apply the last change set
/git stage                stage all changes
/git commit <message>     commit staged changes
/test                     run test command
/lint                     run lint command
/format                   run format command
!<shell command>          run a shell command
/quit                     exit
```

---

## Configuration

Config files are JSON and can be placed at:

- `~/.arceus/config.json` — global defaults
- `.arceus/config.json` — project overrides (takes precedence)

Both files are merged at startup. Project config wins on conflicts.

### Example `.arceus/config.json`

```json
{
  "models": {
    "default": "anthropic:claude-sonnet-4"
  },
  "routing": {
    "planModel": "anthropic:claude-sonnet-4",
    "executeModel": "anthropic:claude-sonnet-4",
    "reviewModel": "openai:gpt-5-mini",
    "fallbackModel": "mock:planner"
  },
  "tools": {
    "testCommand": "npm test",
    "lintCommand": "npm run lint",
    "confirmDestructive": true
  },
  "ui": {
    "theme": "ice"
  }
}
```

### Config sections

| Section | Purpose |
|---|---|
| `models` | Model profiles and default selection |
| `routing` | Per-role model assignment and fallback |
| `live` | Session host, port, file watching |
| `git` | Auto-stage, commit prefix, push rules |
| `github` | PR preparation behavior |
| `ui` | Theme (`ice`, `amber`, `matrix`), sidebar, density |
| `tools` | Shell, timeouts, test/lint/format commands |

Full reference: [docs/config.md](./docs/config.md)

---

## Providers

| Provider | ID prefix | API key env var |
|---|---|---|
| Anthropic | `anthropic:` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai:` | `OPENAI_API_KEY` |
| Local (Ollama) | `local:` | none |
| Mock (offline) | `mock:` | none |

The local provider defaults to `http://127.0.0.1:11434/v1` and is compatible with any OpenAI-compatible server.

All providers use exponential backoff retry on 429 and 5xx responses. A `fallbackModel` can be set in routing config as a secondary provider for when the primary is unavailable.

Full reference: [docs/providers.md](./docs/providers.md)

---

## Live sessions

Live session mode allows multiple terminals to share the same agent session in real time.

**Host a session:**

```bash
arceus session host
# Hosted live session a1b2c3d4 on 127.0.0.1:4318
```

**Join from another terminal:**

```bash
arceus session join a1b2c3d4
```

Each terminal sees the same event stream. File changes, agent actions, and git operations are broadcast to all participants. Conflicts (the same file changed by two participants within 5 seconds) are surfaced as visible events in the stream.

Sessions persist to `.arceus/sessions/` as append-only event logs and can be inspected or replayed after the fact.

Full reference: [docs/live-sessions.md](./docs/live-sessions.md)

---

## Development

```bash
npm run build       # compile TypeScript
npm run check       # type-check without emitting
npm test            # build + run all tests
```

Tests use Node.js's built-in test runner. No test framework dependencies.

---

## Architecture

```
src/
├── agents/       agent runtime and model router
├── cli/          entrypoint and command dispatch
├── config/       config loading, merging, and validation
├── core/         shared types, events, errors, session state
├── github/       commit message and PR draft generation
├── live/         session server, client, protocol, file watcher
├── providers/    Anthropic, OpenAI, local, mock adapters
├── storage/      session persistence (JSONL event log)
├── tools/        file, shell, git, search, diff tools
└── tui/          terminal UI, renderer, theme
```

Full architecture overview: [docs/architecture.md](./docs/architecture.md)

---

## Documentation

- [Architecture](./docs/architecture.md)
- [Command reference](./docs/commands.md)
- [Config reference](./docs/config.md)
- [Provider integration](./docs/providers.md)
- [Live sessions](./docs/live-sessions.md)
- [Initial design note](./docs/design-note-initial-architecture.md)
