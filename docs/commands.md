# Command Reference

## Core

- `arceus`
- `arceus chat`
- `arceus run <task>`
- `arceus test [--command <cmd>]`
- `arceus lint [--command <cmd>]`
- `arceus format [--command <cmd>]`
- `arceus diff`
- `arceus git status`
- `arceus git stage`
- `arceus git commit [--message <msg>]`
- `arceus config init`

## Models

- `arceus models list`
- `arceus models use <model-id> [--global]`

## Sessions

- `arceus session host [--port <number>]`
- `arceus session join <session-id>`
- `arceus session list`
- `arceus session status [session-id]`

## Common `run` flags

- `--mode plan`
- `--mode patch`
- `--apply`
- `--model <model-id>`
- `--json`
- `--stage`
- `--commit`
