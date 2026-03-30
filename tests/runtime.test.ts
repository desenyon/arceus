import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AgentRuntime } from "../src/agents/runtime.js";
import { ModelRouter } from "../src/agents/router.js";
import { ProviderRegistry } from "../src/providers/index.js";
import { SearchTool } from "../src/tools/search-tool.js";
import { ShellTool } from "../src/tools/shell-tool.js";
import { GitTool } from "../src/tools/git-tool.js";
import { RepoContextTool } from "../src/tools/repo-context.js";
import { DEFAULT_CONFIG } from "../src/config/schema.js";

function makeRuntime() {
  const shellTool = new ShellTool();
  const gitTool = new GitTool(shellTool);
  const searchTool = new SearchTool();
  const repoContextTool = new RepoContextTool(searchTool, gitTool, DEFAULT_CONFIG);
  const router = new ModelRouter(DEFAULT_CONFIG);
  const providers = new ProviderRegistry();

  return new AgentRuntime(DEFAULT_CONFIG, router, providers, repoContextTool);
}

test("runtime runs a plan task and returns plan + review", async () => {
  const runtime = makeRuntime();
  const { result, events } = await runtime.runTask({
    cwd: process.cwd(),
    input: "Explain what this project does.",
    mode: "plan"
  });

  assert.equal(typeof result.plan, "string");
  assert.ok(result.plan.length > 0);
  assert.equal(typeof result.review, "string");
  assert.ok(result.review.length > 0);
  assert.equal(result.changeSet, undefined);
  assert.ok(events.length >= 2);
});

test("runtime runs a patch task and returns a change set", async () => {
  const runtime = makeRuntime();
  const { result } = await runtime.runTask({
    cwd: process.cwd(),
    input: "Add a comment to the top of src/core/types.ts.",
    mode: "patch"
  });

  assert.ok(result.changeSet !== undefined);
  assert.equal(typeof result.changeSet.summary, "string");
  assert.ok(Array.isArray(result.changeSet.operations));
});

test("runtime emits task.started and task.completed events", async () => {
  const runtime = makeRuntime();
  const { events } = await runtime.runTask({
    cwd: process.cwd(),
    input: "Check the code.",
    mode: "plan"
  });

  const kinds = events.map((e) => e.kind);
  assert.ok(kinds.includes("task.started"));
  assert.ok(kinds.includes("task.completed"));
});

test("runtime emits diff.prepared event in patch mode", async () => {
  const runtime = makeRuntime();
  const { events } = await runtime.runTask({
    cwd: process.cwd(),
    input: "Add a file.",
    mode: "patch"
  });

  const kinds = events.map((e) => e.kind);
  assert.ok(kinds.includes("diff.prepared"));
});

test("runtime attaches sessionId to events", async () => {
  const runtime = makeRuntime();
  const { events } = await runtime.runTask({
    cwd: process.cwd(),
    input: "Check.",
    mode: "plan",
    sessionId: "test-session"
  });

  for (const event of events) {
    assert.equal(event.sessionId, "test-session");
  }
});
