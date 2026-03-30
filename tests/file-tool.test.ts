import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { FileTool } from "../src/tools/file-tool.js";

test("file tool validates stale before content and applies updates", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "arceus-filetool-"));
  const tool = new FileTool();
  const target = path.join(cwd, "sample.txt");

  await writeFile(target, "before\n", "utf8");

  const issues = await tool.validateChangeSet(cwd, {
    summary: "update file",
    warnings: [],
    operations: [
      {
        type: "update",
        path: "sample.txt",
        reason: "test",
        before: "before\n",
        after: "after\n"
      }
    ]
  });

  assert.equal(issues.length, 0);

  await tool.applyChangeSet(cwd, {
    summary: "update file",
    warnings: [],
    operations: [
      {
        type: "update",
        path: "sample.txt",
        reason: "test",
        before: "before\n",
        after: "after\n"
      }
    ]
  });

  assert.equal(await readFile(target, "utf8"), "after\n");
  await rm(cwd, { force: true, recursive: true });
});

test("file tool reports missing file as an error", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "arceus-filetool-missing-"));
  const tool = new FileTool();
  const issues = await tool.validateChangeSet(cwd, {
    summary: "delete file",
    warnings: [],
    operations: [
      {
        type: "delete",
        path: "missing.txt",
        reason: "cleanup",
        before: "hello"
      }
    ]
  });

  assert.equal(issues[0]?.level, "error");
  await rm(cwd, { force: true, recursive: true });
});
