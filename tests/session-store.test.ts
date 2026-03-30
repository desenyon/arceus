import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SessionStore } from "../src/storage/session-store.js";
import type { SessionEvent } from "../src/core/events.js";
import { createEventId } from "../src/core/events.js";

async function makeTmpDir(): Promise<string> {
  const dir = path.join(tmpdir(), `arceus-store-test-${process.pid}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function makeEvent(sessionId: string, kind: SessionEvent["kind"] = "ui.message"): SessionEvent {
  if (kind === "ui.message") {
    return {
      id: createEventId(),
      sessionId,
      kind: "ui.message",
      timestamp: new Date().toISOString(),
      origin: "system",
      payload: { level: "info", message: "test" }
    };
  }
  return {
    id: createEventId(),
    sessionId,
    kind: "task.started",
    timestamp: new Date().toISOString(),
    origin: "user",
    payload: { input: "test", mode: "plan" }
  };
}

test("appendEvent writes events that readEvents can parse back", async () => {
  const dir = await makeTmpDir();
  try {
    const store = new SessionStore(dir, ".sessions");
    const e1 = makeEvent("sess1");
    const e2 = makeEvent("sess1", "task.started");
    await store.appendEvent(e1);
    await store.appendEvent(e2);

    const events = await store.readEvents("sess1");
    assert.equal(events.length, 2);
    assert.equal(events[0]?.id, e1.id);
    assert.equal(events[1]?.id, e2.id);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("appendEvent is idempotent across multiple calls without rewriting", async () => {
  const dir = await makeTmpDir();
  try {
    const store = new SessionStore(dir, ".sessions");

    for (let i = 0; i < 50; i++) {
      await store.appendEvent(makeEvent("sess2"));
    }

    const events = await store.readEvents("sess2");
    assert.equal(events.length, 50);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("writeDescriptor and readDescriptor round-trip", async () => {
  const dir = await makeTmpDir();
  try {
    const store = new SessionStore(dir, ".sessions");
    const descriptor = {
      sessionId: "abc123",
      cwd: dir,
      host: "127.0.0.1",
      port: 4318,
      createdAt: new Date().toISOString()
    };
    await store.writeDescriptor(descriptor);
    const read = await store.readDescriptor("abc123");
    assert.deepEqual(read, descriptor);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("readDescriptor returns undefined for missing session", async () => {
  const dir = await makeTmpDir();
  try {
    const store = new SessionStore(dir, ".sessions");
    const result = await store.readDescriptor("missing");
    assert.equal(result, undefined);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("listSessionIds returns ids of written sessions", async () => {
  const dir = await makeTmpDir();
  try {
    const store = new SessionStore(dir, ".sessions");
    await store.writeDescriptor({ sessionId: "aaa", cwd: dir, host: "127.0.0.1", port: 1, createdAt: "" });
    await store.writeDescriptor({ sessionId: "bbb", cwd: dir, host: "127.0.0.1", port: 2, createdAt: "" });

    const ids = await store.listSessionIds();
    assert.ok(ids.includes("aaa"));
    assert.ok(ids.includes("bbb"));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("deleteSession removes both meta and event log files", async () => {
  const dir = await makeTmpDir();
  try {
    const store = new SessionStore(dir, ".sessions");
    await store.writeDescriptor({ sessionId: "del1", cwd: dir, host: "127.0.0.1", port: 1, createdAt: "" });
    await store.appendEvent(makeEvent("del1"));

    await store.deleteSession("del1");

    const descriptor = await store.readDescriptor("del1");
    const events = await store.readEvents("del1");
    assert.equal(descriptor, undefined);
    assert.equal(events.length, 0);
  } finally {
    await rm(dir, { recursive: true });
  }
});
