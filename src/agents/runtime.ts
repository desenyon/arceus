import type { SessionEvent } from "../core/events.js";
import { createEventId } from "../core/events.js";
import type { ArceusConfig, ChangeSet, ProviderRequest, RuntimeResult, TaskRequest } from "../core/types.js";
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

function buildExecutorPrompt(request: TaskRequest, repoSummary: string, plan: string): string {
  return [
    "You are Arceus executor.",
    "Return JSON only with shape:",
    "{\"summary\": string, \"warnings\": string[], \"operations\": [{\"type\": \"create|update|delete|rename\", \"path\": string, \"reason\": string, \"before\"?: string, \"after\"?: string, \"fromPath\"?: string}]}",
    "Prefer minimal, reviewable file changes.",
    "Include full file contents in after/before fields for touched files.",
    "",
    `Task: ${request.input}`,
    "",
    "Plan:",
    plan,
    "",
    repoSummary
  ].join("\n");
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

function summarizeRepoContext(files: string[], gitStatus: string): string {
  return [
    "Indexed files:",
    files.slice(0, 50).map((file) => `- ${file}`).join("\n") || "- none",
    "",
    "Git status:",
    gitStatus || "No git status available"
  ].join("\n");
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
    const repoContext = await this.repoContextTool.collect(request.cwd);
    const repoSummary = summarizeRepoContext(repoContext.files, repoContext.gitStatus);
    const events: SessionEvent[] = [
      {
        id: createEventId(),
        sessionId: request.sessionId ?? "standalone",
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
        sessionId: request.sessionId ?? "standalone",
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
    const planResponse = await this.providers.get(models.planner).invoke(planRequest);
    const plan = planResponse.text;

    let changeSet: ChangeSet | undefined;

    if (request.mode === "patch") {
      const executeRequest: ProviderRequest = {
        phase: "executor",
        mode: "patch",
        profile: models.executor,
        systemPrompt: "You generate safe, explicit repository changes.",
        prompt: buildExecutorPrompt(request, repoSummary, plan),
        repoContext,
        output: "changeset"
      };
      const executeResponse = await this.providers.get(models.executor).invoke<ChangeSet>(executeRequest);
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
        sessionId: request.sessionId ?? "standalone",
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
    const reviewResponse = await this.providers.get(models.reviewer).invoke(reviewRequest);
    const review = reviewResponse.text;

    events.push({
      id: createEventId(),
      sessionId: request.sessionId ?? "standalone",
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
