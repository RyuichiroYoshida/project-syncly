import assert from "node:assert/strict";
import { test } from "node:test";

import type { Page } from "../pages.types.js";
import { PageStatus } from "../pages.types.js";

test("PageStatus matches database status values", () => {
  assert.deepEqual(Object.values(PageStatus), [
    "OPEN",
    "CLOSED",
    "EXPIRED",
    "DELETED",
  ]);
});

test("Page type carries camelCase application fields", () => {
  const page: Page = {
    id: "page-1",
    ownerName: "owner",
    editPasswordHash: undefined,
    description: "description",
    place: "room",
    expiresAt: "2026-06-01T10:00:00Z",
    status: PageStatus.OPEN,
    createdAt: "2026-05-31T10:00:00Z",
    updatedAt: "2026-05-31T10:00:00Z",
    deletedAt: undefined,
  };

  assert.equal(page.ownerName, "owner");
  assert.equal(page.expiresAt, "2026-06-01T10:00:00Z");
});
