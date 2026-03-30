import net, { type Socket } from "node:net";

import type { SessionEvent, SessionParticipant } from "../core/events.js";
import { createEventId } from "../core/events.js";
import type { SessionDescriptor, SessionStore } from "../storage/session-store.js";
import { watchWorkspace, type FileWatchHandle } from "./file-watch.js";
import { decodeMessages, encodeMessage, type HelloMessage, type LiveMessage } from "./protocol.js";

interface ConnectionState {
  socket: Socket;
  buffer: string;
  participant?: SessionParticipant;
}

export interface HostOptions {
  cwd: string;
  host: string;
  port: number;
  sessionId: string;
  store: SessionStore;
  participant: SessionParticipant;
  autoWatchFiles: boolean;
}

export class LiveSessionHost {
  private readonly connections = new Map<Socket, ConnectionState>();
  private readonly participants = new Map<string, SessionParticipant>();
  private readonly recentFileChanges = new Map<string, { participantId?: string; timestamp: number }>();
  private server?: net.Server;
  private fileWatch?: FileWatchHandle;
  private readonly descriptor: SessionDescriptor;

  public constructor(private readonly options: HostOptions) {
    this.descriptor = {
      sessionId: options.sessionId,
      cwd: options.cwd,
      host: options.host,
      port: options.port,
      createdAt: new Date().toISOString()
    };
    this.participants.set(options.participant.id, options.participant);
  }

  public async start(): Promise<SessionDescriptor> {
    await this.options.store.writeDescriptor(this.descriptor);
    await this.recordEvent({
      id: createEventId(),
      sessionId: this.options.sessionId,
      kind: "participant.joined",
      timestamp: new Date().toISOString(),
      origin: "system",
      payload: {
        participantId: this.options.participant.id,
        participantName: this.options.participant.name
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket).catch(() => {
          socket.destroy();
        });
      });
      this.server.on("error", reject);
      this.server.listen(this.options.port, this.options.host, () => resolve());
    });

    if (this.options.autoWatchFiles) {
      this.fileWatch = watchWorkspace(this.options.cwd, async (relativePath, eventType) => {
        await this.recordEvent({
          id: createEventId(),
          sessionId: this.options.sessionId,
          kind: "file.changed",
          timestamp: new Date().toISOString(),
          origin: "live",
          payload: {
            path: relativePath,
            changeType: eventType === "rename" ? "update" : "update",
            source: "filesystem"
          }
        });
      });
    }

    return this.descriptor;
  }

  public async stop(): Promise<void> {
    this.fileWatch?.close();

    for (const connection of this.connections.values()) {
      connection.socket.end();
    }

    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
      if (!this.server) {
        resolve();
      }
    });
  }

  public async recordEvent(event: SessionEvent): Promise<void> {
    this.maybeEmitConflict(event);
    await this.options.store.appendEvent(event);
    this.broadcast({
      type: "event",
      event
    });
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const state: ConnectionState = {
      socket,
      buffer: ""
    };
    this.connections.set(socket, state);

    socket.on("data", (chunk: Buffer) => {
      state.buffer += chunk.toString("utf8");
      const decoded = decodeMessages(state.buffer);
      state.buffer = decoded.remaining;

      for (const message of decoded.messages) {
        void this.handleMessage(state, message);
      }
    });

    socket.on("close", () => {
      this.connections.delete(socket);
      if (state.participant) {
        this.participants.delete(state.participant.id);
        void this.recordEvent({
          id: createEventId(),
          sessionId: this.options.sessionId,
          kind: "participant.left",
          timestamp: new Date().toISOString(),
          origin: "live",
          payload: {
            participantId: state.participant.id,
            participantName: state.participant.name
          }
        });
      }
    });
  }

  private async handleMessage(state: ConnectionState, message: LiveMessage): Promise<void> {
    if (message.type === "hello") {
      await this.handleHello(state, message);
      return;
    }

    if (message.type === "event") {
      await this.recordEvent(message.event);
    }
  }

  private async handleHello(state: ConnectionState, message: HelloMessage): Promise<void> {
    state.participant = message.participant;
    this.participants.set(message.participant.id, message.participant);

    const events = await this.options.store.readEvents(this.options.sessionId);
    state.socket.write(
      encodeMessage({
        type: "snapshot",
        events,
        participants: [...this.participants.values()]
      })
    );

    await this.recordEvent({
      id: createEventId(),
      sessionId: this.options.sessionId,
      kind: "participant.joined",
      timestamp: new Date().toISOString(),
      origin: "live",
      payload: {
        participantId: message.participant.id,
        participantName: message.participant.name
      }
    });
  }

  private broadcast(message: LiveMessage): void {
    const encoded = encodeMessage(message);

    for (const connection of this.connections.values()) {
      connection.socket.write(encoded);
    }
  }

  private maybeEmitConflict(event: SessionEvent): void {
    if (event.kind !== "file.changed") {
      return;
    }

    const last = this.recentFileChanges.get(event.payload.path);
    const now = Date.now();
    const participantId = event.participantId;

    if (last && participantId && last.participantId && last.participantId !== participantId && now - last.timestamp < 5000) {
      const conflictEvent: SessionEvent = {
        id: createEventId(),
        sessionId: this.options.sessionId,
        kind: "conflict.detected",
        timestamp: new Date(now).toISOString(),
        origin: "live",
        payload: {
          path: event.payload.path,
          detail: "Multiple participants changed the same file within a short window."
        }
      };

      void this.options.store.appendEvent(conflictEvent).then(() => {
        this.broadcast({
          type: "event",
          event: conflictEvent
        });
      }).catch(() => undefined);
    }

    this.recentFileChanges.set(event.payload.path, {
      ...(participantId ? { participantId } : {}),
      timestamp: now
    });
  }
}
