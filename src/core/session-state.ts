import type { SessionEvent, SessionParticipant } from "./events.js";

export interface SessionState {
  sessionId: string;
  participants: SessionParticipant[];
  recentEvents: SessionEvent[];
  changedFiles: string[];
  currentModelId?: string;
}

export function deriveSessionState(sessionId: string, events: SessionEvent[]): SessionState {
  const participantMap = new Map<string, SessionParticipant>();
  const changedFiles = new Set<string>();
  let currentModelId: string | undefined;

  for (const event of events) {
    if (event.kind === "participant.joined") {
      participantMap.set(event.payload.participantId, {
        id: event.payload.participantId,
        name: event.payload.participantName,
        lastSeenAt: event.timestamp
      });
    }

    if (event.kind === "participant.left") {
      participantMap.delete(event.payload.participantId);
    }

    if (event.kind === "file.changed") {
      changedFiles.add(event.payload.path);
    }

    if (event.kind === "model.switched") {
      currentModelId = event.payload.modelId;
    }
  }

  const state: SessionState = {
    sessionId,
    participants: [...participantMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
    recentEvents: events.slice(-50),
    changedFiles: [...changedFiles].sort((left, right) => left.localeCompare(right))
  };

  if (currentModelId) {
    state.currentModelId = currentModelId;
  }

  return state;
}
