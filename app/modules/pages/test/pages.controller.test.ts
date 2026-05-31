import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { Temporal } from "temporal-polyfill";

import type { HttpContext } from "../../../../tsp-output/server/js/src/generated/helpers/router.js";
import { PageStatus } from "../../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";
import { pagesController } from "../pages.controller.js";
import { pagesService } from "../pages.service.js";

const originalService = { ...pagesService };

afterEach(() => {
  Object.assign(pagesService, originalService);
});

test("create returns 201 when a page is created", async () => {
  pagesService.createPage = async () => pageDetail();
  const ctx = createContext();

  const result = await pagesController.create(ctx, {
    ownerName: "owner",
    description: "description",
    place: "room",
    expiresAt: Temporal.Instant.from("2026-06-01T10:00:00Z"),
    candidates: [],
  });

  assert.equal(ctx.response.statusCode, 201);
  assert.ok("page" in result);
});

test("read returns NOT_FOUND and 404 when service has no page", async () => {
  pagesService.getPageDetail = async () => undefined;
  const ctx = createContext();

  const result = await pagesController.read(ctx, "missing-page");

  assert.equal(ctx.response.statusCode, 404);
  assert.deepEqual(result, {
    code: "NOT_FOUND",
    message: "Page was not found.",
  });
});

test("update maps service error to HTTP status", async () => {
  pagesService.updatePage = async () => ({
    code: "INVALID_REQUEST",
    message: "invalid",
  });
  const ctx = createContext();

  const result = await pagesController.update(ctx, "page-1", {});

  assert.equal(ctx.response.statusCode, 400);
  assert.deepEqual(result, {
    code: "INVALID_REQUEST",
    message: "invalid",
  });
});

test("delete returns service result and sets error status only for errors", async () => {
  pagesService.deletePage = async () => undefined;
  const ctx = createContext();

  const result = await pagesController.delete(ctx, "page-1");

  assert.equal(result, undefined);
  assert.equal(ctx.response.statusCode, 200);
});

test("confirm and remind delegate to service", async () => {
  let confirmedPageId: string | undefined;
  let remindedPageId: string | undefined;
  pagesService.confirmPage = async (pageId) => {
    confirmedPageId = pageId;
    return pageDetail();
  };
  pagesService.remindPage = async (pageId) => {
    remindedPageId = pageId;
  };

  await pagesController.confirm(createContext(), "page-1", {
    candidateId: "candidate-1",
  });
  await pagesController.remind(createContext(), "page-1");

  assert.equal(confirmedPageId, "page-1");
  assert.equal(remindedPageId, "page-1");
});

function createContext(): HttpContext {
  return {
    request: {} as HttpContext["request"],
    response: { statusCode: 200 } as HttpContext["response"],
    errorHandlers: {
      onRequestNotFound() {},
      onInvalidRequest() {},
      onInternalError() {},
    },
  };
}

function pageDetail() {
  const now = Temporal.Instant.from("2026-05-31T10:00:00Z");

  return {
    page: {
      id: "page-1",
      ownerName: "owner",
      description: "description",
      place: "room",
      expiresAt: Temporal.Instant.from("2026-06-01T10:00:00Z"),
      status: PageStatus.Open,
      createdAt: now,
      updatedAt: now,
    },
    candidates: [],
    participants: [],
    availabilitySummary: [],
  };
}
