export type SessionEventKind =
  | "command.completed"
  | "command.started"
  | "conflict.detected"
  | "diff.prepared"
  | "file.changed"
  | "git.action"
  | "model.switched"
  | "participant.joined"
  | "participant.left"
  | "task.completed"
  | "task.started"
  | "ui.message";

export interface SessionEventBase {
  id: string;
  sessionId: string;
  kind: SessionEventKind;
  timestamp: string;
  origin: "agent" | "live" | "system" | "user";
  participantId?: string;
  participantName?: string;
}

export interface ParticipantEvent extends SessionEventBase {
  kind: "participant.joined" | "participant.left";
  payload: {
    participantId: string;
    participantName: string;
  };
}

export interface TaskEvent extends SessionEventBase {
  kind: "task.started" | "task.completed";
  payload: {
    input: string;
    mode: string;
    summary?: string;
  };
}

export interface CommandEvent extends SessionEventBase {
  kind: "command.started" | "command.completed";
  payload: {
    command: string;
    exitCode?: number;
    output?: string;
  };
}

export interface FileChangedEvent extends SessionEventBase {
  kind: "file.changed";
  payload: {
    path: string;
    changeType: "create" | "delete" | "rename" | "update";
    source: "agent" | "filesystem" | "user";
  };
}

export interface DiffPreparedEvent extends SessionEventBase {
  kind: "diff.prepared";
  payload: {
    summary: string;
    files: string[];
  };
}

export interface GitActionEvent extends SessionEventBase {
  kind: "git.action";
  payload: {
    action: string;
    detail: string;
  };
}

export interface ModelSwitchedEvent extends SessionEventBase {
  kind: "model.switched";
  payload: {
    modelId: string;
  };
}

export interface ConflictDetectedEvent extends SessionEventBase {
  kind: "conflict.detected";
  payload: {
    path: string;
    detail: string;
  };
}

export interface UiMessageEvent extends SessionEventBase {
  kind: "ui.message";
  payload: {
    level: "error" | "info" | "success" | "warning";
    message: string;
  };
}

export type SessionEvent =
  | CommandEvent
  | ConflictDetectedEvent
  | DiffPreparedEvent
  | FileChangedEvent
  | GitActionEvent
  | ModelSwitchedEvent
  | ParticipantEvent
  | TaskEvent
  | UiMessageEvent;

export interface SessionParticipant {
  id: string;
  name: string;
  lastSeenAt: string;
}

export function createEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
