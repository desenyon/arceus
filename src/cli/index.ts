#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { hostname, userInfo } from "node:os";

import { createAppContext } from "./context.js";
import { initializeConfig, setDefaultModel } from "../config/load.js";
import { buildCommitMessage, buildPullRequestDraft } from "../github/sync.js";
import { LiveSessionClient } from "../live/client.js";
import { LiveSessionHost } from "../live/server.js";
import { TuiApp } from "../tui/app.js";
import type { SessionParticipant } from "../core/events.js";

function parseFlags(args: string[]): { flags: Map<string, string | true>; positional: string[] } {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token) {
      continue;
    }

    if (token.startsWith("--")) {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        flags.set(token, true);
      } else {
        flags.set(token, next);
        index += 1;
      }
    } else {
      positional.push(token);
    }
  }

  return {
    flags,
    positional
  };
}

function createParticipant(): SessionParticipant {
  const username = userInfo().username;

  return {
    id: `${username}-${process.pid}`,
    name: `${username}@${hostname()}`,
    lastSeenAt: new Date().toISOString()
  };
}

function printUsage(): void {
  console.log([
    "Arceus",
    "",
    "Usage:",
    "  arceus",
    "  arceus chat",
    "  arceus run <task> [--mode plan|patch] [--apply] [--model <id>] [--json] [--yes]",
    "  arceus test [--command <cmd>]",
    "  arceus lint [--command <cmd>]",
    "  arceus format [--command <cmd>]",
    "  arceus models list",
    "  arceus models use <model-id> [--global]",
    "  arceus session host [--port <number>]",
    "  arceus session join <session-id>",
    "  arceus session list",
    "  arceus session status [session-id]",
    "  arceus diff",
    "  arceus git status",
    "  arceus git stage",
    "  arceus git commit [--message <msg>]",
    "  arceus config init [--global]"
  ].join("\n"));
}

async function startTui(cwd: string, sessionId?: string, host?: LiveSessionHost, liveClient?: LiveSessionClient): Promise<void> {
  const context = await createAppContext(cwd);
  const dependencies = {
    config: context.configResolution.config,
    cwd,
    gitTool: context.gitTool,
    initialModelId: context.configResolution.config.models.default,
    runtime: context.runtime,
    shellTool: context.shellTool
  } as ConstructorParameters<typeof TuiApp>[0];

  if (host) {
    dependencies.host = host;
  }

  if (sessionId) {
    dependencies.sessionId = sessionId;
  }

  if (liveClient) {
    dependencies.liveClient = liveClient;
  }

  const app = new TuiApp(dependencies);
  await app.start();
}

async function runConfiguredShellCommand(
  cwd: string,
  label: "format" | "lint" | "test",
  overrideCommand?: string
): Promise<void> {
  const context = await createAppContext(cwd);
  const configCommand = label === "test"
    ? context.configResolution.config.tools.testCommand
    : label === "lint"
      ? context.configResolution.config.tools.lintCommand
      : context.configResolution.config.tools.formatCommand;
  const command = overrideCommand ?? configCommand;
  const result = await context.shellTool.run(
    command,
    cwd,
    context.configResolution.config.tools.shell,
    context.configResolution.config.tools.commandTimeoutMs
  );

  console.log(result.stdout.trim());
  if (result.stderr.trim()) {
    console.error(result.stderr.trim());
  }

  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}

async function run(): Promise<void> {
  const cwd = process.cwd();
  const argv = process.argv.slice(2);
  const [command, subcommand, ...rest] = argv;

  if (!command) {
    await startTui(cwd);
    return;
  }

  if (command === "chat") {
    await startTui(cwd);
    return;
  }

  if (command === "config" && subcommand === "init") {
    const { flags } = parseFlags(rest);
    const context = await createAppContext(cwd);
    const targetPath = flags.has("--global") ? context.configResolution.globalPath : context.configResolution.projectPath;
    await initializeConfig(targetPath);
    console.log(`Initialized config at ${targetPath}`);
    return;
  }

  if (command === "models" && subcommand === "list") {
    const context = await createAppContext(cwd);
    for (const profile of context.configResolution.config.models.profiles) {
      const marker = profile.id === context.configResolution.config.models.default ? "*" : " ";
      console.log(`${marker} ${profile.id} [${profile.provider}] roles=${profile.roles.join(",")}`);
    }
    return;
  }

  if (command === "models" && subcommand === "use") {
    const { flags, positional } = parseFlags(rest);
    const modelId = positional[0];
    if (!modelId) {
      throw new Error("Model id is required.");
    }
    const context = await createAppContext(cwd);
    const targetPath = flags.has("--global") ? context.configResolution.globalPath : context.configResolution.projectPath;
    await setDefaultModel(targetPath, modelId);
    console.log(`Default model set to ${modelId} in ${targetPath}`);
    return;
  }

  if (command === "run") {
    const { flags, positional } = parseFlags([subcommand ?? "", ...rest].filter(Boolean));
    const task = positional.join(" ").trim();

    if (!task) {
      throw new Error("Task text is required.");
    }

    const context = await createAppContext(cwd);
    const mode = (flags.get("--mode") as "patch" | "plan" | undefined) ?? "plan";
    const modelOverride = typeof flags.get("--model") === "string" ? (flags.get("--model") as string) : undefined;
    const request = {
      cwd,
      input: task,
      mode
    } as const;
    const { result } = await context.runtime.runTask(modelOverride ? { ...request, modelOverride } : request);

    if (flags.has("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`# Plan\n${result.plan}\n`);
      if (result.changeSet) {
        console.log(`# Change Set\n${JSON.stringify(result.changeSet, null, 2)}\n`);
        console.log("# Diff\n");
        console.log(context.runtime.diffTool.renderChangeSet(result.changeSet));
      }
      console.log(`\n# Review\n${result.review}\n`);
    }

    if (mode === "patch" && flags.has("--apply") && result.changeSet) {
      const issues = await context.runtime.fileTool.validateChangeSet(cwd, result.changeSet);
      const blocking = issues.find((issue) => issue.level === "error");

      if (blocking) {
        throw new Error(`Cannot apply change set: ${blocking.message}`);
      }

      if (
        context.configResolution.config.tools.confirmDestructive &&
        context.runtime.fileTool.hasDestructiveOperations(result.changeSet) &&
        !flags.has("--yes")
      ) {
        throw new Error("Destructive operations detected. Re-run with --yes after reviewing the diff.");
      }

      const touched = await context.runtime.fileTool.applyChangeSet(cwd, result.changeSet);
      console.log(`Applied ${touched.length} file change(s).`);

      if (flags.has("--stage")) {
        const status = await context.gitTool.stageAll(cwd, context.configResolution.config.tools.shell, context.configResolution.config.tools.commandTimeoutMs);
        console.log(status.raw);
      }

      if (flags.has("--commit")) {
        const commitMessage = typeof flags.get("--commit") === "string"
          ? (flags.get("--commit") as string)
          : buildCommitMessage(result.changeSet);
        const status = await context.gitTool.commit(
          cwd,
          context.configResolution.config.tools.shell,
          context.configResolution.config.tools.commandTimeoutMs,
          commitMessage
        );
        console.log(status.raw);
      }
    }

    return;
  }

  if (command === "test" || command === "lint" || command === "format") {
    const { flags } = parseFlags([subcommand ?? "", ...rest].filter(Boolean));
    const overrideCommand = typeof flags.get("--command") === "string" ? (flags.get("--command") as string) : undefined;
    await runConfiguredShellCommand(cwd, command, overrideCommand);
    return;
  }

  if (command === "diff") {
    const context = await createAppContext(cwd);
    console.log(await context.gitTool.diff(cwd, context.configResolution.config.tools.shell, context.configResolution.config.tools.commandTimeoutMs));
    return;
  }

  if (command === "git" && subcommand === "status") {
    const context = await createAppContext(cwd);
    const status = await context.gitTool.getStatus(cwd, context.configResolution.config.tools.shell, context.configResolution.config.tools.commandTimeoutMs);
    console.log(status.raw || "No git status available.");
    const draft = buildPullRequestDraft(status);
    console.log(`\nSuggested PR title: ${draft.title}`);
    return;
  }

  if (command === "git" && subcommand === "stage") {
    const context = await createAppContext(cwd);
    const status = await context.gitTool.stageAll(cwd, context.configResolution.config.tools.shell, context.configResolution.config.tools.commandTimeoutMs);
    console.log(status.raw);
    return;
  }

  if (command === "git" && subcommand === "commit") {
    const { flags } = parseFlags(rest);
    const context = await createAppContext(cwd);
    const message = typeof flags.get("--message") === "string"
      ? (flags.get("--message") as string)
      : buildCommitMessage();
    const status = await context.gitTool.commit(cwd, context.configResolution.config.tools.shell, context.configResolution.config.tools.commandTimeoutMs, message);
    console.log(status.raw);
    return;
  }

  if (command === "session" && subcommand === "host") {
    const { flags } = parseFlags(rest);
    const context = await createAppContext(cwd);
    const sessionId = randomUUID().slice(0, 8);
    const participant = createParticipant();
    const port = Number(flags.get("--port") ?? context.configResolution.config.live.port);
    const host = new LiveSessionHost({
      autoWatchFiles: context.configResolution.config.live.autoWatchFiles,
      cwd,
      host: context.configResolution.config.live.host,
      participant,
      port,
      sessionId,
      store: context.store
    });
    const descriptor = await host.start();
    console.log(`Hosted live session ${descriptor.sessionId} on ${descriptor.host}:${descriptor.port}`);
    await startTui(cwd, descriptor.sessionId, host);
    return;
  }

  if (command === "session" && subcommand === "join") {
    const sessionId = rest[0];
    if (!sessionId) {
      throw new Error("Session id is required.");
    }

    const context = await createAppContext(cwd);
    const descriptor = await context.store.readDescriptor(sessionId);
    if (!descriptor) {
      throw new Error(`Unknown session id: ${sessionId}`);
    }

    const participant = createParticipant();
    const client = new LiveSessionClient(descriptor, participant);
    await startTui(cwd, sessionId, undefined, client);
    return;
  }

  if (command === "session" && subcommand === "status") {
    const context = await createAppContext(cwd);
    const sessionId = rest[0] ?? (await context.store.listSessionIds()).at(-1);

    if (!sessionId) {
      console.log("No sessions found.");
      return;
    }

    const descriptor = await context.store.readDescriptor(sessionId);
    const events = await context.store.readEvents(sessionId);
    console.log(`Session: ${sessionId}`);
    console.log(`Descriptor: ${descriptor ? JSON.stringify(descriptor, null, 2) : "missing"}`);
    console.log("\nRecent events:");
    for (const event of events.slice(-10)) {
      console.log(`- ${event.timestamp} ${event.kind}`);
    }
    return;
  }

  if (command === "session" && subcommand === "list") {
    const context = await createAppContext(cwd);
    const sessionIds = await context.store.listSessionIds();
    if (sessionIds.length === 0) {
      console.log("No sessions found.");
      return;
    }

    for (const sessionId of sessionIds) {
      const descriptor = await context.store.readDescriptor(sessionId);
      console.log(`${sessionId} ${descriptor?.host ?? "unknown"}:${descriptor?.port ?? "?"} ${descriptor?.createdAt ?? ""}`.trim());
    }
    return;
  }

  if (command === "help") {
    printUsage();
    return;
  }

  printUsage();
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
