import type { SessionEvent, SessionParticipant } from "../core/events.js";

export interface HelloMessage {
  type: "hello";
  participant: SessionParticipant;
}

export interface SnapshotMessage {
  type: "snapshot";
  events: SessionEvent[];
  participants: SessionParticipant[];
}

export interface EventMessage {
  type: "event";
  event: SessionEvent;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type LiveMessage = ErrorMessage | EventMessage | HelloMessage | SnapshotMessage;

export function encodeMessage(message: LiveMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export function decodeMessages(buffer: string): { remaining: string; messages: LiveMessage[] } {
  const lines = buffer.split("\n");
  const remaining = lines.pop() ?? "";
  const messages = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LiveMessage);

  return {
    remaining,
    messages
  };
}
