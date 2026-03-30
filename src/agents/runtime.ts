import type { SessionEvent } from "../core/events.js";
import { createEventId } from "../core/events.js";
import type { ArceusConfig, ChangeSet, ModelProfile, ProviderRequest, RuntimeResult, TaskRequest } from "../core/types.js";
import { ProviderError } from "../core/errors.js";
import { ModelRouter } from "./router.js";
import { ProviderRegistry } from "../providers/index.js";
import { RepoContextTool } from "../tools/repo-context.js";
import { DiffTool } from "../tools/diff-tool.js";
import { FileTool } from "../tools/file-tool.js";

function buildPlanPrompt(request: TaskRequest, repoSummary: string): string {
  return [
    "You are Arceus planner.",
    "Produce a concise technical execution plan for the task.",
    "Highlight likely files, risks, and verification steps.",
    "",
    `Task: ${request.input}`,
    "",
    repoSummary
  ].join("\n");
}

function buildExecutorPrompt(
  request: TaskRequest,
  repoSummary: string,
  plan: string,
  fileContents: Record<string, string>
): string {
  const fileSection = Object.entries(fileContents)
    .slice(0, 15)
    .map(([filePath, content]) => `### ${filePath}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n");

  return [
    "You are Arceus executor.",
    "Return JSON only with shape:",
    "{\"summary\": string, \"warnings\": string[], \"operations\": [{\"type\": \"create|update|delete|rename\", \"path\": string, \"reason\": string, \"before\"?: string, \"after\"?: string, \"fromPath\"?: string}]}",
    "Rules:",
    "- For update/delete/rename, set 'before' to the EXACT current file content shown below.",
    "- For create/update, set 'after' to the complete new file content.",
    "- Prefer minimal diffs. Do not reformat code outside the changed area.",
    "- If a file you need is not shown below, set before to empty string.",
    "",
    `Task: ${request.input}`,
    "",
    "Plan:",
    plan,
    "",
    repoSummary,
    "",
    fileSection ? "File contents:" : "",
    fileSection
  ].filter(Boolean).join("\n");
}

function buildReviewPrompt(request: TaskRequest, repoSummary: string, plan: string, changeSet?: ChangeSet): string {
  return [
    "You are Arceus reviewer.",
    "Summarize risks, validation steps, and what the user should verify.",
    "",
    `Task: ${request.input}`,
    "",
    "Plan:",
    plan,
    "",
    "Repo context:",
    repoSummary,
    "",
    "Change set:",
    changeSet ? JSON.stringify(changeSet, null, 2) : "No file changes proposed."
  ].join("\n");
}

function summarizeRepoContext(files: string[], gitStatus: string, recentDiff?: string): string {
  const parts = [
    "Indexed files:",
    files.slice(0, 50).map((file) => `- ${file}`).join("\n") || "- none",
    "",
    "Git status:",
    gitStatus || "No git status available"
  ];

  if (recentDiff) {
    parts.push("", "Recent diff:", recentDiff.slice(0, 4000));
  }

  return parts.join("\n");
}

async function invokeWithFallback<TStructured>(
  registry: ProviderRegistry,
  primary: ModelProfile,
  fallback: ModelProfile | undefined,
  request: ProviderRequest
): Promise<import("../core/types.js").ProviderResponse<TStructured>> {
  try {
    return await registry.get(primary).invoke<TStructured>(request);
  } catch (error) {
    if (fallback && fallback.id !== primary.id && error instanceof ProviderError) {
      return await registry.get(fallback).invoke<TStructured>({ ...request, profile: fallback });
    }
    throw error;
  }
}

export class AgentRuntime {
  public readonly diffTool = new DiffTool();
  public readonly fileTool = new FileTool();

  public constructor(
    private readonly config: ArceusConfig,
    private readonly router: ModelRouter,
    private readonly providers: ProviderRegistry,
    private readonly repoContextTool: RepoContextTool
  ) {}

  public async runTask(request: TaskRequest): Promise<{ events: SessionEvent[]; result: RuntimeResult }> {
    const models = this.router.resolveModels(request.mode, request.modelOverride);
    const fallbackProfile = this.config.routing.fallbackModel
      ? this.router.resolveModels(request.mode, this.config.routing.fallbackModel).executor
      : undefined;
    const repoContext = await this.repoContextTool.collect(request.cwd);
    const repoSummary = summarizeRepoContext(repoContext.files, repoContext.gitStatus, repoContext.recentDiff);
    const sessionId = request.sessionId ?? "standalone";
    const events: SessionEvent[] = [
      {
        id: createEventId(),
        sessionId,
        kind: "task.started",
        timestamp: new Date().toISOString(),
        origin: "user",
        payload: {
          input: request.input,
          mode: request.mode
        }
      },
      {
        id: createEventId(),
        sessionId,
        kind: "model.switched",
        timestamp: new Date().toISOString(),
        origin: "system",
        payload: {
          modelId: models.executor.id
        }
      }
    ];

    const planRequest: ProviderRequest = {
      phase: "planner",
      mode: "plan",
      profile: models.planner,
      systemPrompt: "You are a repository-aware coding planner.",
      prompt: buildPlanPrompt(request, repoSummary),
      repoContext,
      output: "text"
    };
    const planResponse = await invokeWithFallback(this.providers, models.planner, fallbackProfile, planRequest);
    const plan = planResponse.text;

    let changeSet: ChangeSet | undefined;

    if (request.mode === "patch") {
      const executeRequest: ProviderRequest = {
        phase: "executor",
        mode: "patch",
        profile: models.executor,
        systemPrompt: "You generate safe, explicit repository changes.",
        prompt: buildExecutorPrompt(request, repoSummary, plan, repoContext.fileContents ?? {}),
        repoContext,
        output: "changeset"
      };
      const executeResponse = await invokeWithFallback<ChangeSet>(this.providers, models.executor, fallbackProfile, executeRequest);
      changeSet = executeResponse.structured;

      if (!changeSet) {
        changeSet = {
          summary: "Executor returned no structured change set.",
          warnings: ["No structured change set was parsed from the model response."],
          operations: []
        };
      }

      events.push({
        id: createEventId(),
        sessionId,
        kind: "diff.prepared",
        timestamp: new Date().toISOString(),
        origin: "agent",
        payload: {
          summary: changeSet.summary,
          files: changeSet.operations.map((operation) => operation.path)
        }
      });
    }

    const reviewRequest: ProviderRequest = {
      phase: "reviewer",
      mode: "summary",
      profile: models.reviewer,
      systemPrompt: "You are a precise reviewer focused on validation and safety.",
      prompt: buildReviewPrompt(request, repoSummary, plan, changeSet),
      repoContext,
      output: "text"
    };
    const reviewResponse = await invokeWithFallback(this.providers, models.reviewer, fallbackProfile, reviewRequest);
    const review = reviewResponse.text;

    events.push({
      id: createEventId(),
      sessionId,
      kind: "task.completed",
      timestamp: new Date().toISOString(),
      origin: "agent",
      payload: {
        input: request.input,
        mode: request.mode,
        summary: changeSet?.summary ?? plan.split("\n")[0] ?? "Task complete"
      }
    });

    const result: RuntimeResult = changeSet
      ? {
          request,
          models,
          plan,
          changeSet,
          review
        }
      : {
          request,
          models,
          plan,
          review
        };

    return {
      events,
      result
    };
  }
}
