import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SearchTool } from "../src/tools/search-tool.js";

async function makeTmpDir(): Promise<string> {
  const dir = path.join(tmpdir(), `arceus-search-test-${process.pid}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

test("listFiles returns relative paths sorted", async () => {
  const dir = await makeTmpDir();
  try {
    await mkdir(path.join(dir, "src"), { recursive: true });
    await writeFile(path.join(dir, "src", "a.ts"), "a");
    await writeFile(path.join(dir, "src", "b.ts"), "b");
    await writeFile(path.join(dir, "README.md"), "readme");

    const tool = new SearchTool();
    const files = await tool.listFiles(dir, 100);

    assert.ok(files.includes("README.md"));
    assert.ok(files.includes(path.join("src", "a.ts")));
    assert.ok(files.includes(path.join("src", "b.ts")));
    assert.deepEqual(files, [...files].sort());
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("listFiles ignores node_modules and .git", async () => {
  const dir = await makeTmpDir();
  try {
    await mkdir(path.join(dir, "node_modules", "pkg"), { recursive: true });
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, "node_modules", "pkg", "index.js"), "x");
    await writeFile(path.join(dir, ".git", "HEAD"), "ref");
    await writeFile(path.join(dir, "index.ts"), "real");

    const tool = new SearchTool();
    const files = await tool.listFiles(dir, 100);

    assert.ok(files.includes("index.ts"));
    assert.ok(!files.some((f) => f.includes("node_modules")));
    assert.ok(!files.some((f) => f.includes(".git")));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("listFiles respects the limit", async () => {
  const dir = await makeTmpDir();
  try {
    for (let i = 0; i < 10; i++) {
      await writeFile(path.join(dir, `file${i}.ts`), `${i}`);
    }

    const tool = new SearchTool();
    const files = await tool.listFiles(dir, 5);

    assert.equal(files.length, 5);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("grepFiles finds matching lines with line numbers", async () => {
  const dir = await makeTmpDir();
  try {
    await writeFile(path.join(dir, "foo.ts"), "const hello = 1;\nconst world = 2;\n");

    const tool = new SearchTool();
    const matches = await tool.grepFiles(dir, "world", 50);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.file, "foo.ts");
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.text ?? "", /world/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("grepFiles is case-insensitive", async () => {
  const dir = await makeTmpDir();
  try {
    await writeFile(path.join(dir, "bar.ts"), "function HELLO() {}\n");

    const tool = new SearchTool();
    const matches = await tool.grepFiles(dir, "hello", 50);

    assert.equal(matches.length, 1);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("grepFiles returns empty for no matches", async () => {
  const dir = await makeTmpDir();
  try {
    await writeFile(path.join(dir, "empty.ts"), "nothing here\n");

    const tool = new SearchTool();
    const matches = await tool.grepFiles(dir, "xyzzy_no_match", 50);

    assert.equal(matches.length, 0);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("grepFiles skips binary files", async () => {
  const dir = await makeTmpDir();
  try {
    const buf = Buffer.alloc(16);
    buf.write("hello");
    buf[5] = 0;
    await writeFile(path.join(dir, "binary.bin"), buf);

    const tool = new SearchTool();
    const matches = await tool.grepFiles(dir, "hello", 50);

    assert.equal(matches.length, 0);
  } finally {
    await rm(dir, { recursive: true });
  }
});
