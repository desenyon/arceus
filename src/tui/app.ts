import { createHash } from "node:crypto";
import { hostname, userInfo } from "node:os";
import readline from "node:readline";

import type { AgentRuntime } from "../agents/runtime.js";
import { createEventId, type SessionEvent, type SessionParticipant } from "../core/events.js";
import type { ArceusConfig, ChangeSet } from "../core/types.js";
import type { LiveSessionClient } from "../live/client.js";
import type { LiveSessionHost } from "../live/server.js";
import type { GitTool } from "../tools/git-tool.js";
import type { ShellTool } from "../tools/shell-tool.js";
import { deriveSessionState } from "../core/session-state.js";
import { renderDashboard } from "./render.js";
import { THEMES } from "./theme.js";
import type { Theme } from "./theme.js";

interface TuiDependencies {
  config: ArceusConfig;
  cwd: string;
  gitTool: GitTool;
  host?: LiveSessionHost;
  initialModelId: string;
  runtime: AgentRuntime;
  sessionId?: string;
  shellTool: ShellTool;
  liveClient?: LiveSessionClient;
}

const INSPECTOR_SCROLL_STEP = 5;

export class TuiApp {
  private currentInput = "";
  private currentMode: "patch" | "plan" = "plan";
  private currentModelId: string;
  private events: SessionEvent[] = [];
  private inspectorMode: "changes" | "diff" | "help" | "output" | "plan" | "review" = "help";
  private inspectorScrollOffset = 0;
  private message = "Ready.";
  private lastChangeSet: ChangeSet | undefined;
  private lastDiffText = "";
  private lastPlan = "";
  private lastReview = "";
  private lastCommandOutput = "";
  private participants: SessionParticipant[] = [];
  private branch = "n/a";
  private readonly theme: Theme;
  private readonly participant: SessionParticipant;

  public constructor(private readonly dependencies: TuiDependencies) {
    this.currentModelId = dependencies.initialModelId;
    const configuredTheme = THEMES[dependencies.config.ui.theme as keyof typeof THEMES];
    this.theme = configuredTheme ?? THEMES["ice"]!;
    const username = userInfo().username;
    const name = `${username}@${hostname()}`;
    this.participant = {
      id: createHash("sha1").update(`${name}:${process.pid}`).digest("hex").slice(0, 12),
      name,
      lastSeenAt: new Date().toISOString()
    };
  }

  public async start(): Promise<void> {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdout.write("\u001B[?1049h\u001B[?25l");
    await this.refreshBranch();

    if (this.dependencies.liveClient) {
      this.dependencies.liveClient.on("snapshot", ({ events, participants }) => {
        this.events = events;
        this.participants = participants;
        this.render();
      });
      this.dependencies.liveClient.on("event", (event) => {
        this.events.push(event);
        const state = deriveSessionState(this.dependencies.sessionId ?? "session", this.events);
        this.participants = state.participants;
        this.render();
      });
      await this.dependencies.liveClient.connect();
    } else {
      this.participants = [this.participant];
    }

    process.stdin.on("keypress", (character, key) => {
      void this.handleKeypress(character, key);
    });

    this.render();
  }

  private async handleKeypress(character: string, key: readline.Key): Promise<void> {
    if (key.ctrl && key.name === "c") {
      await this.shutdown();
      return;
    }

    if (key.name === "return") {
      const input = this.currentInput.trim();
      this.currentInput = "";
      await this.handleInput(input);
      this.render();
      return;
    }

    if (key.name === "backspace") {
      this.currentInput = this.currentInput.slice(0, -1);
      this.render();
      return;
    }

    if (key.name === "tab") {
      this.currentMode = this.currentMode === "plan" ? "patch" : "plan";
      this.message = `Mode switched to ${this.currentMode}.`;
      this.render();
      return;
    }

    if (key.name === "pagedown") {
      this.inspectorScrollOffset += INSPECTOR_SCROLL_STEP;
      this.render();
      return;
    }

    if (key.name === "pageup") {
      this.inspectorScrollOffset = Math.max(0, this.inspectorScrollOffset - INSPECTOR_SCROLL_STEP);
      this.render();
      return;
    }

    if (!key.ctrl && !key.meta && character) {
      this.currentInput += character;
      this.render();
    }
  }

  private async handleInput(input: string): Promise<void> {
    if (input.length === 0) {
      return;
    }

    if (input === "/quit") {
      await this.shutdown();
      return;
    }

    if (input === "/help") {
      this.inspectorMode = "help";
      this.inspectorScrollOffset = 0;
      this.message = "Enter a prompt, /mode plan|patch, /model <id>, !<shell>, /apply, /quit. Tab toggles mode.";
      return;
    }

    if (input.startsWith("/mode ")) {
      const mode = input.replace("/mode ", "").trim();
      if (mode === "plan" || mode === "patch") {
        this.currentMode = mode;
        this.message = `Mode set to ${mode}.`;
      } else {
        this.message = "Unknown mode. Use plan or patch.";
      }
      return;
    }

    if (input.startsWith("/model ")) {
      this.currentModelId = input.replace("/model ", "").trim();
      await this.emitEvent({
        id: createEventId(),
        sessionId: this.dependencies.sessionId ?? "standalone",
        kind: "model.switched",
        timestamp: new Date().toISOString(),
        origin: "user",
        payload: {
          modelId: this.currentModelId
        }
      });
      this.message = `Model override set to ${this.currentModelId}.`;
      return;
    }

    if (input === "/apply") {
      await this.applyChangeSet();
      return;
    }

    if (input === "/diff") {
      this.inspectorMode = "diff";
      this.inspectorScrollOffset = 0;
      this.message = "Inspector set to diff view.";
      return;
    }

    if (input.startsWith("/view ")) {
      const mode = input.replace("/view ", "").trim();
      if (mode === "changes" || mode === "diff" || mode === "help" || mode === "output" || mode === "plan" || mode === "review") {
        this.inspectorMode = mode;
        this.inspectorScrollOffset = 0;
        this.message = `Inspector set to ${mode}.`;
      } else {
        this.message = "Unknown view. Use changes, diff, help, output, plan, or review.";
      }
      return;
    }

    if (input === "/git stage") {
      await this.stageGitChanges();
      return;
    }

    if (input.startsWith("/git commit")) {
      const message = input.replace("/git commit", "").trim();
      await this.commitGitChanges(message);
      return;
    }

    if (input === "/test") {
      await this.runShell(this.dependencies.config.tools.testCommand);
      return;
    }

    if (input === "/lint") {
      await this.runShell(this.dependencies.config.tools.lintCommand);
      return;
    }

    if (input === "/format") {
      await this.runShell(this.dependencies.config.tools.formatCommand);
      return;
    }

    if (input.startsWith("!")) {
      await this.runShell(input.slice(1));
      return;
    }

    await this.runTask(input);
  }

  private async runTask(input: string): Promise<void> {
    this.message = `Running ${this.currentMode} task...`;
    this.render();

    try {
      const { events, result } = await this.dependencies.runtime.runTask({
        cwd: this.dependencies.cwd,
        input,
        mode: this.currentMode,
        ...(this.currentModelId ? { modelOverride: this.currentModelId } : {}),
        ...(this.dependencies.sessionId ? { sessionId: this.dependencies.sessionId } : {})
      });

      for (const event of events) {
        await this.emitEvent(event);
      }

      this.lastPlan = result.plan;
      this.lastReview = result.review;
      this.lastChangeSet = result.changeSet;
      this.lastDiffText = result.changeSet ? this.dependencies.runtime.diffTool.renderChangeSet(result.changeSet) : "";
      this.inspectorMode = result.changeSet ? "diff" : "review";
      this.inspectorScrollOffset = 0;
      this.message = result.review.split("\n")[0] ?? "Task complete.";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.message = `Error: ${message}`;
      await this.emitEvent({
        id: createEventId(),
        sessionId: this.dependencies.sessionId ?? "standalone",
        kind: "ui.message",
        timestamp: new Date().toISOString(),
        origin: "system",
        payload: {
          level: "error",
          message
        }
      });
    }
  }

  private async runShell(command: string): Promise<void> {
    if (
      this.dependencies.config.tools.confirmDestructive &&
      this.dependencies.shellTool.isDestructive(command)
    ) {
      this.message = "Refusing destructive shell command from the TUI.";
      return;
    }

    const started: SessionEvent = {
      id: createEventId(),
      sessionId: this.dependencies.sessionId ?? "standalone",
      kind: "command.started",
      timestamp: new Date().toISOString(),
      origin: "user",
      payload: {
        command
      }
    };
    await this.emitEvent(started);

    try {
      const result = await this.dependencies.shellTool.run(
        command,
        this.dependencies.cwd,
        this.dependencies.config.tools.shell,
        this.dependencies.config.tools.commandTimeoutMs
      );

      const output = `${result.stdout}\n${result.stderr}`.trim();
      await this.emitEvent({
        id: createEventId(),
        sessionId: this.dependencies.sessionId ?? "standalone",
        kind: "command.completed",
        timestamp: new Date().toISOString(),
        origin: "system",
        payload: {
          command,
          exitCode: result.exitCode,
          output
        }
      });
      this.lastCommandOutput = `$ ${command}\n\n${output || "(no output)"}`;
      this.inspectorMode = "output";
      this.inspectorScrollOffset = 0;
      this.message = `Command exited with ${result.exitCode}.`;
      await this.refreshBranch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.message = `Shell error: ${message}`;
    }
  }

  private async applyChangeSet(): Promise<void> {
    if (!this.lastChangeSet) {
      this.message = "No change set available.";
      return;
    }

    if (
      this.dependencies.config.tools.confirmDestructive &&
      this.dependencies.runtime.fileTool.hasDestructiveOperations(this.lastChangeSet)
    ) {
      this.message = "Destructive changes detected. Use the CLI run command for explicit confirmation.";
      return;
    }

    const issues = await this.dependencies.runtime.fileTool.validateChangeSet(this.dependencies.cwd, this.lastChangeSet);
    const blocking = issues.find((issue) => issue.level === "error");

    if (blocking) {
      this.message = `Cannot apply change set: ${blocking.message}`;
      return;
    }

    try {
      const touched = await this.dependencies.runtime.fileTool.applyChangeSet(this.dependencies.cwd, this.lastChangeSet);

      for (const file of touched) {
        await this.emitEvent({
          id: createEventId(),
          sessionId: this.dependencies.sessionId ?? "standalone",
          kind: "file.changed",
          timestamp: new Date().toISOString(),
          origin: "agent",
          payload: {
            path: file,
            changeType: "update",
            source: "agent"
          }
        });
      }

      this.message = `Applied ${touched.length} file change(s).`;
      await this.refreshBranch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.message = `Apply failed: ${message}`;
    }
  }

  private async stageGitChanges(): Promise<void> {
    try {
      const status = await this.dependencies.gitTool.stageAll(
        this.dependencies.cwd,
        this.dependencies.config.tools.shell,
        this.dependencies.config.tools.commandTimeoutMs
      );
      await this.emitEvent({
        id: createEventId(),
        sessionId: this.dependencies.sessionId ?? "standalone",
        kind: "git.action",
        timestamp: new Date().toISOString(),
        origin: "user",
        payload: {
          action: "stage",
          detail: "Staged repository changes."
        }
      });
      this.message = status.raw || "Staged changes.";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.message = `Stage failed: ${message}`;
    }
  }

  private async commitGitChanges(message: string): Promise<void> {
    const commitMessage = message || (this.lastChangeSet ? `feat: ${this.lastChangeSet.summary}` : "chore: update repository state");

    try {
      const status = await this.dependencies.gitTool.commit(
        this.dependencies.cwd,
        this.dependencies.config.tools.shell,
        this.dependencies.config.tools.commandTimeoutMs,
        commitMessage
      );
      await this.emitEvent({
        id: createEventId(),
        sessionId: this.dependencies.sessionId ?? "standalone",
        kind: "git.action",
        timestamp: new Date().toISOString(),
        origin: "user",
        payload: {
          action: "commit",
          detail: commitMessage
        }
      });
      this.message = status.raw || `Committed with message: ${commitMessage}`;
      await this.refreshBranch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.message = `Commit failed: ${message}`;
    }
  }

  private async emitEvent(event: SessionEvent): Promise<void> {
    const enrichedEvent: SessionEvent = {
      ...event,
      participantId: event.participantId ?? this.participant.id,
      participantName: event.participantName ?? this.participant.name
    };

    if (this.dependencies.host) {
      await this.dependencies.host.recordEvent(enrichedEvent);
    }

    if (this.dependencies.liveClient) {
      this.dependencies.liveClient.sendEvent(enrichedEvent);
    } else {
      this.events.push(enrichedEvent);
    }

    const state = deriveSessionState(this.dependencies.sessionId ?? "standalone", this.events);
    this.participants = state.participants.length > 0 ? state.participants : this.participants;
  }

  private async refreshBranch(): Promise<void> {
    try {
      const status = await this.dependencies.gitTool.getStatus(
        this.dependencies.cwd,
        this.dependencies.config.tools.shell,
        this.dependencies.config.tools.commandTimeoutMs
      );
      this.branch = status.branch;
    } catch {
      // non-git directories are allowed
    }
  }

  private render(): void {
    const inspector = this.getInspectorContent();
    const view = {
      branch: this.branch,
      changedFiles: deriveSessionState(this.dependencies.sessionId ?? "standalone", this.events).changedFiles,
      currentInput: this.currentInput,
      currentMode: this.currentMode,
      currentModelId: this.currentModelId,
      events: this.events,
      inspectorLines: inspector.lines,
      inspectorScrollOffset: this.inspectorScrollOffset,
      inspectorTitle: inspector.title,
      message: this.message,
      participants: this.participants,
      prompt: this.dependencies.sessionId ? `arceus:${this.dependencies.sessionId}> ` : "arceus> "
    } as Parameters<typeof renderDashboard>[0];

    if (this.lastChangeSet) {
      view.changeSet = this.lastChangeSet;
    }

    const output = renderDashboard(
      view,
      process.stdout.columns || 120,
      process.stdout.rows || 32,
      this.theme
    );

    process.stdout.write("\u001B[2J\u001B[H");
    process.stdout.write(output);
  }

  private getInspectorContent(): { lines: string[]; title: string } {
    if (this.inspectorMode === "plan") {
      return {
        title: " Plan ",
        lines: this.lastPlan ? this.lastPlan.split("\n") : ["No plan yet."]
      };
    }

    if (this.inspectorMode === "review") {
      return {
        title: " Review ",
        lines: this.lastReview ? this.lastReview.split("\n") : ["No review yet."]
      };
    }

    if (this.inspectorMode === "changes") {
      return {
        title: " Change Set ",
        lines: this.lastChangeSet
          ? [
              `summary: ${this.lastChangeSet.summary}`,
              "",
              ...this.lastChangeSet.warnings.map((warning) => `warning: ${warning}`),
              "",
              JSON.stringify(this.lastChangeSet.operations, null, 2)
            ]
          : ["No change set yet."]
      };
    }

    if (this.inspectorMode === "diff") {
      return {
        title: " Diff ",
        lines: this.lastDiffText ? this.lastDiffText.split("\n") : ["No diff yet."]
      };
    }

    if (this.inspectorMode === "output") {
      return {
        title: " Output ",
        lines: this.lastCommandOutput ? this.lastCommandOutput.split("\n") : ["No command output yet."]
      };
    }

    return {
      title: " Help ",
      lines: [
        "Prompt input runs the agent.",
        "",
        "Commands:",
        "  /mode plan|patch",
        "  /view help|plan|review|changes|diff|output",
        "  /diff",
        "  /apply",
        "  /git stage",
        "  /git commit <message>",
        "  /test",
        "  /lint",
        "  /format",
        "  !<shell command>",
        "  /quit",
        "",
        "Keyboard:",
        "  Tab       toggle plan/patch mode",
        "  PgDn      scroll inspector down",
        "  PgUp      scroll inspector up",
        "  Ctrl+C    quit"
      ]
    };
  }

  private async shutdown(): Promise<void> {
    this.dependencies.liveClient?.disconnect();
    await this.dependencies.host?.stop();
    process.stdout.write("\u001B[?25h\u001B[?1049l");
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  }
}
