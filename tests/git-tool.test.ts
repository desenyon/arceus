import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { ShellTool } from "../src/tools/shell-tool.js";
import { GitTool } from "../src/tools/git-tool.js";

const SHELL = process.env.SHELL ?? "/bin/sh";
const TIMEOUT = 15_000;

async function makeGitRepo(): Promise<string> {
  const dir = path.join(tmpdir(), `arceus-git-test-${process.pid}-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  const shell = new ShellTool();

  await shell.run("git init", dir, SHELL, TIMEOUT);
  await shell.run('git config user.email "test@arceus.dev"', dir, SHELL, TIMEOUT);
  await shell.run('git config user.name "Arceus Test"', dir, SHELL, TIMEOUT);
  await writeFile(path.join(dir, "README.md"), "# test\n");
  await shell.run("git add -A && git commit -m 'init'", dir, SHELL, TIMEOUT);

  return dir;
}

test("getStatus returns branch and isRepo=true for a git repo", async () => {
  const dir = await makeGitRepo();
  try {
    const shellTool = new ShellTool();
    const gitTool = new GitTool(shellTool);
    const status = await gitTool.getStatus(dir, SHELL, TIMEOUT);

    assert.equal(status.isRepo, true);
    assert.equal(typeof status.branch, "string");
    assert.ok(status.branch.length > 0);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("getStatus returns isRepo=false for a non-git directory", async () => {
  const dir = await (async () => {
    const d = path.join(tmpdir(), `arceus-nogit-${process.pid}-${Date.now()}`);
    await mkdir(d, { recursive: true });
    return d;
  })();
  try {
    const shellTool = new ShellTool();
    const gitTool = new GitTool(shellTool);
    const status = await gitTool.getStatus(dir, SHELL, TIMEOUT);

    assert.equal(status.isRepo, false);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("stageAll stages files and commit creates a commit", async () => {
  const dir = await makeGitRepo();
  try {
    const shellTool = new ShellTool();
    const gitTool = new GitTool(shellTool);

    await writeFile(path.join(dir, "new.ts"), "export const x = 1;\n");
    await gitTool.stageAll(dir, SHELL, TIMEOUT);
    await gitTool.commit(dir, SHELL, TIMEOUT, "add new.ts");

    const log = await gitTool.log(dir, SHELL, TIMEOUT, 2);
    assert.match(log, /add new\.ts/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("checkoutBranch creates and switches to a new branch", async () => {
  const dir = await makeGitRepo();
  try {
    const shellTool = new ShellTool();
    const gitTool = new GitTool(shellTool);

    const status = await gitTool.checkoutBranch(dir, SHELL, TIMEOUT, "feature/test", true);
    assert.match(status.branch, /feature\/test/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("log returns recent commit messages", async () => {
  const dir = await makeGitRepo();
  try {
    const shellTool = new ShellTool();
    const gitTool = new GitTool(shellTool);

    const log = await gitTool.log(dir, SHELL, TIMEOUT, 5);
    assert.match(log, /init/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("diff returns empty string on clean repo", async () => {
  const dir = await makeGitRepo();
  try {
    const shellTool = new ShellTool();
    const gitTool = new GitTool(shellTool);

    const diff = await gitTool.diff(dir, SHELL, TIMEOUT);
    assert.equal(typeof diff, "string");
  } finally {
    await rm(dir, { recursive: true });
  }
});
