import type { SessionEvent, SessionParticipant } from "../core/events.js";
import type { ChangeSet } from "../core/types.js";
import type { Theme } from "./theme.js";

function truncate(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (value.length <= width) {
    return value.padEnd(width, " ");
  }

  if (width <= 1) {
    return value.slice(0, width);
  }

  return `${value.slice(0, width - 1)}…`;
}

function colorizeDiffLine(line: string, theme: Theme): string {
  if (line.startsWith("+")) {
    return `${theme.success}${line}${theme.reset}`;
  }

  if (line.startsWith("-")) {
    return `${theme.error}${line}${theme.reset}`;
  }

  if (line.startsWith("#") || line.startsWith("rename ")) {
    return `${theme.accent}${line}${theme.reset}`;
  }

  return line;
}

function wrapLines(value: string, width: number): string[] {
  if (width <= 1) {
    return [value.slice(0, Math.max(width, 0))];
  }

  const rawLines = value.split("\n");
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    if (rawLine.length === 0) {
      wrapped.push("");
      continue;
    }

    let remaining = rawLine;

    while (remaining.length > width) {
      wrapped.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }

    wrapped.push(remaining);
  }

  return wrapped;
}

function renderBox(
  title: string,
  lines: string[],
  width: number,
  height: number,
  theme: Theme,
  scrollOffset = 0
): string[] {
  const innerWidth = Math.max(width - 2, 0);
  const top = `${theme.dim}┌${"─".repeat(Math.max(innerWidth, 0))}┐${theme.reset}`;
  const bottom = `${theme.dim}└${"─".repeat(Math.max(innerWidth, 0))}┘${theme.reset}`;
  const titleLine = truncate(`${title}`, innerWidth);
  const contentHeight = Math.max(height - 2, 0);

  const scrolled = lines.slice(
    Math.min(scrollOffset, Math.max(lines.length - contentHeight, 0)),
    Math.min(scrollOffset, Math.max(lines.length - contentHeight, 0)) + contentHeight
  );

  const padded = scrolled.map((line) => `${theme.dim}│${theme.reset}${truncate(line, innerWidth)}${theme.dim}│${theme.reset}`);

  while (padded.length < contentHeight) {
    padded.push(`${theme.dim}│${theme.reset}${" ".repeat(innerWidth)}${theme.dim}│${theme.reset}`);
  }

  if (padded.length > 0) {
    padded[0] = `${theme.dim}│${theme.reset}${theme.accent}${titleLine}${theme.reset}${" ".repeat(Math.max(innerWidth - titleLine.length, 0))}${theme.dim}│${theme.reset}`;
  }

  return [top, ...padded, bottom];
}

export interface TuiViewModel {
  branch: string;
  changedFiles: string[];
  changeSet?: ChangeSet;
  currentInput: string;
  currentMode: "patch" | "plan";
  currentModelId: string;
  events: SessionEvent[];
  inspectorLines: string[];
  inspectorScrollOffset: number;
  inspectorTitle: string;
  message: string;
  participants: SessionParticipant[];
  prompt: string;
}

function formatEvent(event: SessionEvent): string {
  const stamp = event.timestamp.slice(11, 19);

  switch (event.kind) {
    case "command.completed":
      return `${stamp} cmd done ${event.payload.command} (${event.payload.exitCode ?? 0})`;
    case "command.started":
      return `${stamp} cmd start ${event.payload.command}`;
    case "diff.prepared":
      return `${stamp} diff ${event.payload.summary}`;
    case "file.changed":
      return `${stamp} file ${event.payload.changeType} ${event.payload.path}`;
    case "git.action":
      return `${stamp} git ${event.payload.action}: ${event.payload.detail}`;
    case "model.switched":
      return `${stamp} model ${event.payload.modelId}`;
    case "participant.joined":
      return `${stamp} join ${event.payload.participantName}`;
    case "participant.left":
      return `${stamp} leave ${event.payload.participantName}`;
    case "task.completed":
      return `${stamp} task done ${event.payload.summary ?? event.payload.input}`;
    case "task.started":
      return `${stamp} task start ${event.payload.input}`;
    case "ui.message":
      return `${stamp} ${event.payload.level} ${event.payload.message}`;
    case "conflict.detected":
      return `${stamp} conflict ${event.payload.path}: ${event.payload.detail}`;
  }
}

export function renderDashboard(view: TuiViewModel, columns: number, rows: number, theme: Theme): string {
  const sidebarWidth = Math.max(Math.floor(columns * 0.24), 28);
  const inspectorWidth = Math.max(Math.floor(columns * 0.34), 36);
  const eventWidth = Math.max(columns - sidebarWidth - inspectorWidth - 2, 30);
  const bodyHeight = Math.max(rows - 4, 8);
  const sidebarLines = [
    `mode: ${view.currentMode}`,
    `model: ${view.currentModelId}`,
    `branch: ${view.branch}`,
    "",
    "participants:",
    ...(view.participants.length > 0 ? view.participants.map((participant) => `- ${participant.name}`) : ["- solo"]),
    "",
    "changed files:",
    ...(view.changedFiles.length > 0 ? view.changedFiles.slice(0, 10).map((file) => `- ${file}`) : ["- none"])
  ];
  const eventLines = view.events.length > 0 ? view.events.slice(-Math.max(bodyHeight - 2, 1)).map(formatEvent) : ["No activity yet."];
  const inspectorSource = view.inspectorLines.length > 0
    ? view.inspectorLines.flatMap((line) => wrapLines(line, inspectorWidth - 4))
    : ["No inspector content yet."];

  const totalInspectorLines = inspectorSource.length;
  const scrollIndicator = totalInspectorLines > bodyHeight - 2
    ? ` [${view.inspectorScrollOffset + 1}-${Math.min(view.inspectorScrollOffset + bodyHeight - 2, totalInspectorLines)}/${totalInspectorLines}]`
    : "";

  const sidebarBox = renderBox(" Arceus ", sidebarLines, sidebarWidth, bodyHeight, theme);
  const eventsBox = renderBox(" Event Stream ", eventLines, eventWidth, bodyHeight, theme);
  const inspectorBox = renderBox(
    ` ${view.inspectorTitle}${scrollIndicator} `,
    inspectorSource,
    inspectorWidth,
    bodyHeight,
    theme,
    view.inspectorScrollOffset
  );
  const lines: string[] = [];

  for (let index = 0; index < bodyHeight; index += 1) {
    lines.push(`${sidebarBox[index] ?? ""}${eventsBox[index] ?? ""}${inspectorBox[index] ?? ""}`);
  }

  const promptLine = `${theme.accent}${view.prompt}${theme.reset}${view.currentInput}`;
  const footerText = `${view.message || "Commands: /help /mode plan|patch /model <id> !<shell> /apply /quit"}`;
  const scrollHint = totalInspectorLines > bodyHeight - 2 ? " | PgUp/PgDn to scroll inspector" : "";
  const diffPreview = view.changeSet
    ? wrapLines(view.changeSet.operations.length > 0 ? view.changeSet.operations.map((operation) => `${operation.type} ${operation.path}`).join(" | ") : "No file operations proposed.", columns)
    : ["No diff preview."];

  const footerLines = [
    truncate(promptLine, columns),
    truncate(`${footerText}${scrollHint}`, columns),
    truncate(diffPreview.join(" "), columns)
  ];

  return [...lines, ...footerLines.map((line) => colorizeDiffLine(line, theme))].join("\n");
}
