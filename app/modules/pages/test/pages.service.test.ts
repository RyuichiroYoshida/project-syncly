import assert from "node:assert/strict";
import { test } from "node:test";

import { pagesService } from "../pages.service.js";

test("pagesService exposes page use cases", () => {
  assert.equal(typeof pagesService.createPage, "function");
  assert.equal(typeof pagesService.getPageDetail, "function");
  assert.equal(typeof pagesService.updatePage, "function");
  assert.equal(typeof pagesService.deletePage, "function");
  assert.equal(typeof pagesService.confirmPage, "function");
  assert.equal(typeof pagesService.remindPage, "function");
});
