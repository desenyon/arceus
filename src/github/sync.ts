import type { ChangeSet } from "../core/types.js";
import type { GitStatusSummary } from "../tools/git-tool.js";

export interface PullRequestDraft {
  title: string;
  body: string;
}

export function buildPullRequestDraft(status: GitStatusSummary, changeSet?: ChangeSet): PullRequestDraft {
  const summary = changeSet?.summary ?? "Repository changes prepared with Arceus.";
  const files = changeSet?.operations.map((operation) => `- ${operation.type}: ${operation.path}`).join("\n") ?? "- No structured change set available";

  return {
    title: summary.slice(0, 72),
    body: [
      "## Summary",
      summary,
      "",
      "## Branch",
      status.branch,
      "",
      "## Files",
      files
    ].join("\n")
  };
}

export function buildCommitMessage(changeSet?: ChangeSet): string {
  if (!changeSet || changeSet.operations.length === 0) {
    return "chore: update repository state";
  }

  const verbs = new Set(changeSet.operations.map((operation) => operation.type));

  if (verbs.size === 1) {
    const [verb] = [...verbs];
    if (verb === "create") {
      return `feat: ${changeSet.summary}`;
    }
    if (verb === "update") {
      return `refactor: ${changeSet.summary}`;
    }
    if (verb === "delete") {
      return `chore: ${changeSet.summary}`;
    }
  }

  return `feat: ${changeSet.summary}`;
}
