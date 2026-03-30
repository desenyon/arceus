import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ShellTool } from "../src/tools/shell-tool.js";

const tool = new ShellTool();

test("shell tool runs a simple command and captures stdout", async () => {
  const result = await tool.run("echo hello", process.cwd(), "/bin/sh", 5000);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /hello/);
  assert.equal(result.stderr, "");
  assert.equal(result.command, "echo hello");
});

test("shell tool captures non-zero exit code", async () => {
  const result = await tool.run("exit 42", process.cwd(), "/bin/sh", 5000);
  assert.equal(result.exitCode, 42);
});

test("shell tool captures stderr separately", async () => {
  const result = await tool.run("echo warn >&2", process.cwd(), "/bin/sh", 5000);
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /warn/);
});

test("shell tool times out long-running commands", async () => {
  await assert.rejects(
    () => tool.run("sleep 10", process.cwd(), "/bin/sh", 100),
    /timed out/i
  );
});

test("isDestructive detects rm -rf", () => {
  assert.equal(tool.isDestructive("rm -rf /tmp/foo"), true);
});

test("isDestructive detects git reset --hard", () => {
  assert.equal(tool.isDestructive("git reset --hard HEAD"), true);
});

test("isDestructive passes safe commands", () => {
  assert.equal(tool.isDestructive("npm test"), false);
  assert.equal(tool.isDestructive("ls -la"), false);
  assert.equal(tool.isDestructive("echo hello"), false);
});
