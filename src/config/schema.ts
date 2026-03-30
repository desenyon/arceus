import type { ArceusConfig } from "../core/types.js";

export const DEFAULT_CONFIG: ArceusConfig = {
  models: {
    default: "mock:planner",
    profiles: [
      {
        id: "mock:planner",
        provider: "mock",
        model: "planner",
        label: "Mock Planner",
        roles: ["planner", "executor", "reviewer"],
        capabilities: {
          streaming: false,
          toolCalls: false,
          maxContextTokens: 16000,
          maxOutputTokens: 4000
        },
        temperature: 0.1
      },
      {
        id: "openai:gpt-5-mini",
        provider: "openai",
        model: "gpt-5-mini",
        roles: ["planner", "executor", "reviewer"],
        capabilities: {
          streaming: true,
          toolCalls: true,
          maxContextTokens: 200000
        }
      },
      {
        id: "anthropic:claude-sonnet-4",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        roles: ["planner", "executor", "reviewer"],
        capabilities: {
          streaming: true,
          toolCalls: true,
          maxContextTokens: 200000
        }
      },
      {
        id: "local:llama",
        provider: "local",
        model: "llama3.1",
        baseUrl: "http://127.0.0.1:11434/v1",
        roles: ["planner", "reviewer"],
        capabilities: {
          streaming: false,
          toolCalls: false,
          maxContextTokens: 32000
        }
      }
    ]
  },
  routing: {
    autoRoute: true,
    latencyPreference: "balanced",
    costPreference: "balanced",
    reasoningDepth: "medium",
    fallbackModel: "mock:planner",
    planModel: "mock:planner"
  },
  live: {
    host: "127.0.0.1",
    port: 4318,
    autoWatchFiles: true,
    persistenceDir: ".arceus/sessions"
  },
  git: {
    autoStage: false,
    autoCommitInLiveSession: false,
    defaultCommitPrefix: "arceus",
    allowPush: false
  },
  github: {
    enabled: true,
    cliCommand: "gh",
    autoPreparePullRequest: false
  },
  ui: {
    denseMode: true,
    showSidebar: true,
    theme: "ice",
    diffContextLines: 3
  },
  tools: {
    shell: process.env.SHELL ?? "/bin/sh",
    confirmDestructive: true,
    maxSearchResults: 200,
    commandTimeoutMs: 120000,
    testCommand: "npm test",
    lintCommand: "npm run lint",
    formatCommand: "npm run format"
  }
};
