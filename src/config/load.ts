import { homedir } from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { ConfigError } from "../core/errors.js";
import type { ArceusConfig, ModelProfile } from "../core/types.js";
import { DEFAULT_CONFIG } from "./schema.js";

function validateConfig(config: ArceusConfig): void {
  const { models, routing } = config;

  if (!models.default) {
    throw new ConfigError("models.default must be set.");
  }

  if (!Array.isArray(models.profiles) || models.profiles.length === 0) {
    throw new ConfigError("models.profiles must be a non-empty array.");
  }

  const ids = new Set<string>();

  for (const profile of models.profiles) {
    if (!profile.id) {
      throw new ConfigError("Each model profile must have an id.");
    }

    if (ids.has(profile.id)) {
      throw new ConfigError(`Duplicate model profile id: ${profile.id}.`);
    }

    ids.add(profile.id);

    if (!profile.provider) {
      throw new ConfigError(`Model profile ${profile.id} must have a provider.`);
    }

    if (!profile.model) {
      throw new ConfigError(`Model profile ${profile.id} must have a model name.`);
    }

    if (!Array.isArray(profile.roles) || profile.roles.length === 0) {
      throw new ConfigError(`Model profile ${profile.id} must have at least one role.`);
    }
  }

  if (!ids.has(models.default)) {
    throw new ConfigError(`models.default references unknown profile: ${models.default}.`);
  }

  if (routing.fallbackModel && !ids.has(routing.fallbackModel)) {
    throw new ConfigError(`routing.fallbackModel references unknown profile: ${routing.fallbackModel}.`);
  }

  if (routing.planModel && !ids.has(routing.planModel)) {
    throw new ConfigError(`routing.planModel references unknown profile: ${routing.planModel}.`);
  }

  if (routing.executeModel && !ids.has(routing.executeModel)) {
    throw new ConfigError(`routing.executeModel references unknown profile: ${routing.executeModel}.`);
  }

  if (routing.reviewModel && !ids.has(routing.reviewModel)) {
    throw new ConfigError(`routing.reviewModel references unknown profile: ${routing.reviewModel}.`);
  }
}

export interface ConfigResolution {
  config: ArceusConfig;
  globalPath: string;
  projectPath: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mergeRecord<T>(base: T, override: Partial<T> | undefined): T {
  if (!override) {
    return base;
  }

  return { ...base, ...override };
}

function mergeProfiles(defaultProfiles: ModelProfile[], overrideProfiles: ModelProfile[] | undefined): ModelProfile[] {
  if (!overrideProfiles || overrideProfiles.length === 0) {
    return defaultProfiles;
  }

  const byId = new Map<string, ModelProfile>();

  for (const profile of defaultProfiles) {
    byId.set(profile.id, profile);
  }

  for (const profile of overrideProfiles) {
    byId.set(profile.id, profile);
  }

  return [...byId.values()];
}

function mergeConfig(base: ArceusConfig, override: Partial<ArceusConfig> | undefined): ArceusConfig {
  if (!override) {
    return structuredClone(base);
  }

  return {
    models: {
      ...base.models,
      ...override.models,
      profiles: mergeProfiles(base.models.profiles, override.models?.profiles)
    },
    routing: mergeRecord(base.routing, override.routing),
    live: mergeRecord(base.live, override.live),
    git: mergeRecord(base.git, override.git),
    github: mergeRecord(base.github, override.github),
    ui: mergeRecord(base.ui, override.ui),
    tools: mergeRecord(base.tools, override.tools)
  };
}

async function readConfigFile(filePath: string): Promise<Partial<ArceusConfig> | undefined> {
  try {
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents) as unknown;

    if (!isObject(parsed)) {
      throw new ConfigError(`Config file ${filePath} must contain a JSON object.`);
    }

    return parsed as Partial<ArceusConfig>;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    if (error instanceof ConfigError) {
      throw error;
    }

    throw new ConfigError(`Unable to read config file ${filePath}: ${String(error)}`);
  }
}

export function resolveConfigPaths(cwd: string): { globalPath: string; projectPath: string } {
  return {
    globalPath: path.join(homedir(), ".arceus", "config.json"),
    projectPath: path.join(cwd, ".arceus", "config.json")
  };
}

export async function loadConfig(cwd: string): Promise<ConfigResolution> {
  const { globalPath, projectPath } = resolveConfigPaths(cwd);
  const globalConfig = await readConfigFile(globalPath);
  const projectConfig = await readConfigFile(projectPath);
  const config = mergeConfig(mergeConfig(DEFAULT_CONFIG, globalConfig), projectConfig);
  validateConfig(config);

  return {
    config,
    globalPath,
    projectPath
  };
}

export async function initializeConfig(targetPath: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
}

export async function setDefaultModel(targetPath: string, modelId: string): Promise<void> {
  const current = (await readConfigFile(targetPath)) ?? {};
  const next = mergeConfig(DEFAULT_CONFIG, {
    ...current,
    models: {
      ...DEFAULT_CONFIG.models,
      ...current.models,
      default: modelId,
      profiles: current.models?.profiles ?? DEFAULT_CONFIG.models.profiles
    }
  });

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}
