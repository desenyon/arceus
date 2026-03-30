export type ProviderName = "anthropic" | "local" | "mock" | "openai";

export type AgentPhase = "executor" | "planner" | "reviewer";

export type TaskMode = "patch" | "plan" | "summary";

export type PreferenceLevel = "balanced" | "high" | "low";

export type ReasoningDepth = "high" | "low" | "medium";

export type ChangeType = "create" | "delete" | "rename" | "update";

export interface ProviderCapabilities {
  streaming: boolean;
  toolCalls: boolean;
  maxContextTokens?: number;
  maxOutputTokens?: number;
  costPerMillionInput?: number;
  costPerMillionOutput?: number;
}

export interface ModelProfile {
  id: string;
  provider: ProviderName;
  model: string;
  label?: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  headers?: Record<string, string>;
  roles: AgentPhase[];
  capabilities: ProviderCapabilities;
  temperature?: number;
}

export interface ModelsConfig {
  default: string;
  profiles: ModelProfile[];
}

export interface RoutingConfig {
  autoRoute: boolean;
  latencyPreference: PreferenceLevel;
  costPreference: PreferenceLevel;
  reasoningDepth: ReasoningDepth;
  fallbackModel?: string;
  planModel?: string;
  executeModel?: string;
  reviewModel?: string;
}

export interface LiveConfig {
  host: string;
  port: number;
  autoWatchFiles: boolean;
  persistenceDir: string;
}

export interface GitConfig {
  autoStage: boolean;
  autoCommitInLiveSession: boolean;
  defaultCommitPrefix: string;
  allowPush: boolean;
}

export interface GitHubConfig {
  enabled: boolean;
  cliCommand: string;
  autoPreparePullRequest: boolean;
}

export interface UiConfig {
  denseMode: boolean;
  showSidebar: boolean;
  theme: "amber" | "ice" | "matrix";
  diffContextLines: number;
}

export interface ToolsConfig {
  shell: string;
  confirmDestructive: boolean;
  maxSearchResults: number;
  commandTimeoutMs: number;
  testCommand: string;
  lintCommand: string;
  formatCommand: string;
}

export interface ArceusConfig {
  models: ModelsConfig;
  routing: RoutingConfig;
  live: LiveConfig;
  git: GitConfig;
  github: GitHubConfig;
  ui: UiConfig;
  tools: ToolsConfig;
}

export interface RepoContext {
  cwd: string;
  files: string[];
  gitStatus: string;
  recentDiff?: string;
  fileContents?: Record<string, string>;
}

export interface TaskRequest {
  cwd: string;
  input: string;
  mode: TaskMode;
  modelOverride?: string;
  sessionId?: string;
}

export interface ChangeOperation {
  type: ChangeType;
  path: string;
  reason: string;
  before?: string;
  after?: string;
  fromPath?: string;
}

export interface ChangeSet {
  summary: string;
  warnings: string[];
  operations: ChangeOperation[];
}

export interface FileValidationIssue {
  level: "error" | "warning";
  message: string;
  path: string;
}

export interface ProviderRequest {
  phase: AgentPhase;
  mode: TaskMode;
  profile: ModelProfile;
  systemPrompt: string;
  prompt: string;
  repoContext: RepoContext;
  output: "changeset" | "text";
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ProviderResponse<TStructured = unknown> {
  provider: ProviderName;
  model: string;
  text: string;
  structured?: TStructured;
  usage?: ProviderUsage;
}

export interface PlannedModels {
  planner: ModelProfile;
  executor: ModelProfile;
  reviewer: ModelProfile;
}

export interface RuntimeResult {
  request: TaskRequest;
  models: PlannedModels;
  plan: string;
  changeSet?: ChangeSet;
  review: string;
}
