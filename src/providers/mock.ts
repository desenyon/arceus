import type { ChangeSet, ProviderRequest, ProviderResponse } from "../core/types.js";
import type { ProviderAdapter } from "./base.js";

function buildMockPlan(request: ProviderRequest): string {
  const files = request.repoContext.files.slice(0, 8).join(", ") || "no indexed files yet";

  return [
    `Task: ${request.prompt}`,
    "",
    "Execution plan:",
    `1. Inspect the repo areas closest to the request. Indexed files: ${files}.`,
    "2. Propose a minimal, reviewable set of changes.",
    "3. Validate the repo state with tests or targeted commands.",
    "4. Summarize user-visible outcomes and any remaining gaps."
  ].join("\n");
}

function buildMockChangeSet(request: ProviderRequest): ChangeSet {
  return {
    summary: `Mock executor prepared a safe no-op change set for: ${request.prompt}`,
    warnings: [
      "Mock provider is active. Configure a real model profile to generate file changes."
    ],
    operations: []
  };
}

export class MockProviderAdapter implements ProviderAdapter {
  public readonly name = "mock";

  public async invoke<TStructured>(request: ProviderRequest): Promise<ProviderResponse<TStructured>> {
    if (request.output === "changeset") {
      const structured = buildMockChangeSet(request) as TStructured;

      return {
        provider: "mock",
        model: request.profile.model,
        text: JSON.stringify(structured, null, 2),
        structured
      };
    }

    return {
      provider: "mock",
      model: request.profile.model,
      text: buildMockPlan(request)
    };
  }
}
