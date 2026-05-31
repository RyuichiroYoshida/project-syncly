import assert from "node:assert/strict";
import { test } from "node:test";

test("pages.schema can be imported without side effects", async () => {
  const module = await import("../pages.schema.js");

  assert.deepEqual(Object.keys(module), []);
});
