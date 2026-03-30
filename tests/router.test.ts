import assert from "node:assert/strict";
import test from "node:test";

import { ModelRouter } from "../src/agents/router.js";
import { DEFAULT_CONFIG } from "../src/config/schema.js";

test("router resolves explicit override for all phases", () => {
  const router = new ModelRouter(DEFAULT_CONFIG);
  const models = router.resolveModels("patch", "mock:planner");

  assert.equal(models.planner.id, "mock:planner");
  assert.equal(models.executor.id, "mock:planner");
  assert.equal(models.reviewer.id, "mock:planner");
});

test("router selects role-specific models when available", () => {
  const router = new ModelRouter({
    ...DEFAULT_CONFIG,
    routing: {
      ...DEFAULT_CONFIG.routing,
      executeModel: "openai:gpt-5-mini",
      reviewModel: "local:llama"
    }
  });
  const models = router.resolveModels("patch");

  assert.equal(models.executor.id, "openai:gpt-5-mini");
  assert.equal(models.reviewer.id, "local:llama");
});
