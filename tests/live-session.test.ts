import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createEventId } from "../src/core/events.js";
import { LiveSessionClient } from "../src/live/client.js";
import { LiveSessionHost } from "../src/live/server.js";
import { SessionStore } from "../src/storage/session-store.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("live host broadcasts events to joined clients", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "arceus-live-"));
  const store = new SessionStore(cwd, ".arceus/sessions");
  const sessionId = "session-test";
  const host = new LiveSessionHost({
    autoWatchFiles: false,
    cwd,
    host: "127.0.0.1",
    participant: {
      id: "host",
      name: "Host",
      lastSeenAt: new Date().toISOString()
    },
    port: 45321,
    sessionId,
    store
  });
  const descriptor = await host.start();
  const client = new LiveSessionClient(descriptor, {
    id: "guest",
    name: "Guest",
    lastSeenAt: new Date().toISOString()
  });
  let received = false;

  client.on("event", (event) => {
    if (event.kind === "ui.message" && event.payload.message === "hello") {
      received = true;
    }
  });

  await client.connect();
  await delay(100);
  await host.recordEvent({
    id: createEventId(),
    sessionId,
    kind: "ui.message",
    timestamp: new Date().toISOString(),
    origin: "system",
    payload: {
      level: "info",
      message: "hello"
    }
  });
  await delay(100);

  assert.equal(received, true);
  client.disconnect();
  await host.stop();
  await rm(cwd, { force: true, recursive: true });
});
