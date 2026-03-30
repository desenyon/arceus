import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MockProviderAdapter } from "../src/providers/mock.js";
import { extractJsonBlock } from "../src/providers/base.js";
import type { ProviderRequest } from "../src/core/types.js";
import { DEFAULT_CONFIG } from "../src/config/schema.js";

const mockProfile = DEFAULT_CONFIG.models.profiles.find((p) => p.provider === "mock")!;

function makeRequest(output: "changeset" | "text"): ProviderRequest {
  return {
    phase: "planner",
    mode: "plan",
    profile: mockProfile,
    systemPrompt: "You are a test agent.",
    prompt: "Add a greeting function.",
    repoContext: {
      cwd: "/tmp",
      files: ["src/index.ts"],
      gitStatus: ""
    },
    output
  };
}

test("mock provider returns text for text output", async () => {
  const adapter = new MockProviderAdapter();
  const response = await adapter.invoke(makeRequest("text"));
  assert.equal(response.provider, "mock");
  assert.equal(typeof response.text, "string");
  assert.ok(response.text.length > 0);
  assert.equal(response.structured, undefined);
});

test("mock provider returns structured change set for changeset output", async () => {
  const adapter = new MockProviderAdapter();
  const response = await adapter.invoke(makeRequest("changeset"));
  assert.equal(response.provider, "mock");
  assert.ok(response.structured !== undefined);
  const cs = response.structured as { summary: string; operations: unknown[] };
  assert.equal(typeof cs.summary, "string");
  assert.ok(Array.isArray(cs.operations));
});

test("mock provider returns empty operations for changeset", async () => {
  const adapter = new MockProviderAdapter();
  const response = await adapter.invoke(makeRequest("changeset"));
  const cs = response.structured as { operations: unknown[] };
  assert.equal(cs.operations.length, 0);
});

test("mock provider name is mock", () => {
  const adapter = new MockProviderAdapter();
  assert.equal(adapter.name, "mock");
});

test("extractJsonBlock parses fenced JSON block", () => {
  const text = "some text\n```json\n{\"key\": \"value\"}\n```\nmore text";
  const result = extractJsonBlock<{ key: string }>(text);
  assert.deepEqual(result, { key: "value" });
});

test("extractJsonBlock parses bare JSON", () => {
  const text = '{"key": "value"}';
  const result = extractJsonBlock<{ key: string }>(text);
  assert.deepEqual(result, { key: "value" });
});

test("extractJsonBlock returns undefined for invalid JSON", () => {
  const result = extractJsonBlock("not json at all");
  assert.equal(result, undefined);
});
