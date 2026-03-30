# Config Reference

Arceus supports both global and project-local JSON config.

## Locations

- Global: `~/.arceus/config.json`
- Project: `<repo>/.arceus/config.json`

Project config overrides global config.

## Top-level keys

- `models`
- `routing`
- `live`
- `git`
- `github`
- `ui`
- `tools`

## Example

```json
{
  "models": {
    "default": "mock:planner",
    "profiles": [
      {
        "id": "openai:gpt-5-mini",
        "provider": "openai",
        "model": "gpt-5-mini",
        "apiKeyEnv": "OPENAI_API_KEY",
        "roles": ["planner", "executor", "reviewer"],
        "capabilities": {
          "streaming": true,
          "toolCalls": true,
          "maxContextTokens": 200000
        }
      }
    ]
  },
  "routing": {
    "autoRoute": true,
    "latencyPreference": "balanced",
    "costPreference": "balanced",
    "reasoningDepth": "medium",
    "planModel": "openai:gpt-5-mini",
    "executeModel": "anthropic:claude-sonnet-4",
    "reviewModel": "local:llama3"
  },
  "live": {
    "host": "127.0.0.1",
    "port": 4318,
    "autoWatchFiles": true
  },
  "tools": {
    "testCommand": "npm test",
    "lintCommand": "npm run lint",
    "formatCommand": "npm run format"
  }
}
```

## Secrets

API keys are loaded from environment variables named in each model profile. Secrets should never be committed to project config.
