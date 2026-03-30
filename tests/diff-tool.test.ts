import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DiffTool } from "../src/tools/diff-tool.js";
import type { ChangeSet } from "../src/core/types.js";

const tool = new DiffTool();

test("diff tool renders a create operation", () => {
  const changeSet: ChangeSet = {
    summary: "add hello.ts",
    warnings: [],
    operations: [
      {
        type: "create",
        path: "hello.ts",
        reason: "add greeting file",
        after: "export const greeting = 'hello';\n"
      }
    ]
  };

  const output = tool.renderChangeSet(changeSet);
  assert.match(output, /\+\+\+ b\/hello\.ts/);
  assert.match(output, /\+export const greeting/);
});

test("diff tool renders a delete operation", () => {
  const changeSet: ChangeSet = {
    summary: "remove old.ts",
    warnings: [],
    operations: [
      {
        type: "delete",
        path: "old.ts",
        reason: "no longer needed",
        before: "const x = 1;\n"
      }
    ]
  };

  const output = tool.renderChangeSet(changeSet);
  assert.match(output, /--- a\/old\.ts/);
  assert.match(output, /\+\+\+ \/dev\/null/);
  assert.match(output, /-const x = 1/);
});

test("diff tool renders an update operation with diff", () => {
  const changeSet: ChangeSet = {
    summary: "update greeting",
    warnings: [],
    operations: [
      {
        type: "update",
        path: "greet.ts",
        reason: "change message",
        before: "const msg = 'hello';\n",
        after: "const msg = 'goodbye';\n"
      }
    ]
  };

  const output = tool.renderChangeSet(changeSet);
  assert.match(output, /--- a\/greet\.ts/);
  assert.match(output, /\+\+\+ b\/greet\.ts/);
  assert.match(output, /-const msg = 'hello'/);
  assert.match(output, /\+const msg = 'goodbye'/);
});

test("diff tool renders a rename operation", () => {
  const changeSet: ChangeSet = {
    summary: "rename file",
    warnings: [],
    operations: [
      {
        type: "rename",
        path: "new-name.ts",
        fromPath: "old-name.ts",
        reason: "rename module",
        before: "export {};\n",
        after: "export {};\n"
      }
    ]
  };

  const output = tool.renderChangeSet(changeSet);
  assert.match(output, /rename from old-name\.ts/);
  assert.match(output, /rename to new-name\.ts/);
});

test("diff tool renders empty change set as empty string", () => {
  const changeSet: ChangeSet = {
    summary: "no changes",
    warnings: [],
    operations: []
  };

  const output = tool.renderChangeSet(changeSet);
  assert.equal(output, "");
});

test("diff tool separates multiple operations", () => {
  const changeSet: ChangeSet = {
    summary: "multi-op",
    warnings: [],
    operations: [
      { type: "create", path: "a.ts", reason: "add a", after: "const a = 1;\n" },
      { type: "create", path: "b.ts", reason: "add b", after: "const b = 2;\n" }
    ]
  };

  const output = tool.renderChangeSet(changeSet);
  assert.match(output, /a\.ts/);
  assert.match(output, /b\.ts/);
});
