import assert from "node:assert/strict";
import test from "node:test";

import { buildCommitMessage } from "../src/github/sync.js";

test("buildCommitMessage chooses a feature prefix for create-heavy changes", () => {
  const message = buildCommitMessage({
    summary: "add live session dashboard",
    warnings: [],
    operations: [
      {
        type: "create",
        path: "src/live/dashboard.ts",
        reason: "new feature",
        after: "export const x = 1;\n"
      }
    ]
  });

  assert.equal(message, "feat: add live session dashboard");
});

test("buildCommitMessage falls back for empty change sets", () => {
  assert.equal(buildCommitMessage(), "chore: update repository state");
});
