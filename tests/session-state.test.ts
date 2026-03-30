import assert from "node:assert/strict";
import test from "node:test";

import { deriveSessionState } from "../src/core/session-state.js";
import type { SessionEvent } from "../src/core/events.js";

test("session state tracks participants, changed files, and model switches", () => {
  const events: SessionEvent[] = [
    {
      id: "1",
      sessionId: "abc",
      kind: "participant.joined",
      timestamp: "2026-01-01T00:00:00.000Z",
      origin: "system",
      payload: {
        participantId: "alice",
        participantName: "Alice"
      }
    },
    {
      id: "2",
      sessionId: "abc",
      kind: "model.switched",
      timestamp: "2026-01-01T00:00:01.000Z",
      origin: "user",
      payload: {
        modelId: "openai:gpt-5-mini"
      }
    },
    {
      id: "3",
      sessionId: "abc",
      kind: "file.changed",
      timestamp: "2026-01-01T00:00:02.000Z",
      origin: "agent",
      payload: {
        path: "src/index.ts",
        changeType: "update",
        source: "agent"
      }
    }
  ];
  const state = deriveSessionState("abc", events);

  assert.equal(state.participants.length, 1);
  assert.equal(state.currentModelId, "openai:gpt-5-mini");
  assert.deepEqual(state.changedFiles, ["src/index.ts"]);
});
