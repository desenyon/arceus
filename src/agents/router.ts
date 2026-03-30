import { ConfigError } from "../core/errors.js";
import type { ArceusConfig, ModelProfile, PlannedModels, TaskMode } from "../core/types.js";

function findProfile(config: ArceusConfig, modelId: string): ModelProfile {
  const profile = config.models.profiles.find((candidate) => candidate.id === modelId);

  if (!profile) {
    throw new ConfigError(`Unknown model profile: ${modelId}`);
  }

  return profile;
}

function firstProfileForRole(config: ArceusConfig, role: ModelProfile["roles"][number]): ModelProfile {
  const profile = config.models.profiles.find((candidate) => candidate.roles.includes(role));

  if (!profile) {
    throw new ConfigError(`No model profile configured for role ${role}.`);
  }

  return profile;
}

export class ModelRouter {
  public constructor(private readonly config: ArceusConfig) {}

  public resolveModels(mode: TaskMode, overrideModelId?: string): PlannedModels {
    if (overrideModelId) {
      const override = findProfile(this.config, overrideModelId);

      return {
        planner: override,
        executor: override,
        reviewer: override
      };
    }

    const planner = this.config.routing.planModel
      ? findProfile(this.config, this.config.routing.planModel)
      : firstProfileForRole(this.config, "planner");

    const executor = this.config.routing.executeModel
      ? findProfile(this.config, this.config.routing.executeModel)
      : mode === "plan"
        ? planner
        : firstProfileForRole(this.config, "executor");

    const reviewer = this.config.routing.reviewModel
      ? findProfile(this.config, this.config.routing.reviewModel)
      : firstProfileForRole(this.config, "reviewer");

    return {
      planner,
      executor,
      reviewer
    };
  }
}
