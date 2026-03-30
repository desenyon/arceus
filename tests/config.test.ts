import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../src/config/load.js";

test("project config overrides defaults", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "arceus-config-"));
  await mkdir(path.join(cwd, ".arceus"), { recursive: true });

  await writeFile(
    path.join(cwd, ".arceus", "config.json"),
    JSON.stringify({
      models: {
        default: "local:llama",
        profiles: []
      },
      routing: {
        autoRoute: false
      }
    }),
    { encoding: "utf8", flag: "w" }
  );

  const resolution = await loadConfig(cwd);
  assert.equal(resolution.config.models.default, "local:llama");
  assert.equal(resolution.config.routing.autoRoute, false);

  await rm(cwd, { force: true, recursive: true });
});
