import net from "node:net";
import { EventEmitter } from "node:events";

import type { SessionEvent, SessionParticipant } from "../core/events.js";
import type { SessionDescriptor } from "../storage/session-store.js";
import { decodeMessages, encodeMessage, type LiveMessage } from "./protocol.js";

interface LiveSessionClientEvents {
  error: [Error];
  event: [SessionEvent];
  snapshot: [{ events: SessionEvent[]; participants: SessionParticipant[] }];
}

export class LiveSessionClient extends EventEmitter<LiveSessionClientEvents> {
  private readonly socket = new net.Socket();
  private buffer = "";

  public constructor(
    private readonly descriptor: SessionDescriptor,
    private readonly participant: SessionParticipant
  ) {
    super();
  }

  public async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.socket.connect(this.descriptor.port, this.descriptor.host, () => resolve());
      this.socket.once("error", reject);
    });

    this.socket.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      const decoded = decodeMessages(this.buffer);
      this.buffer = decoded.remaining;

      for (const message of decoded.messages) {
        this.handleMessage(message);
      }
    });
    this.socket.on("error", (error) => {
      this.emit("error", error);
    });

    this.socket.write(
      encodeMessage({
        type: "hello",
        participant: this.participant
      })
    );
  }

  public disconnect(): void {
    this.socket.end();
  }

  public sendEvent(event: SessionEvent): void {
    this.socket.write(
      encodeMessage({
        type: "event",
        event
      })
    );
  }

  private handleMessage(message: LiveMessage): void {
    if (message.type === "snapshot") {
      this.emit("snapshot", {
        events: message.events,
        participants: message.participants
      });
      return;
    }

    if (message.type === "event") {
      this.emit("event", message.event);
      return;
    }

    if (message.type === "error") {
      this.emit("error", new Error(message.message));
    }
  }
}
