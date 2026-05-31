import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { Temporal } from "temporal-polyfill";

import type { HttpContext } from "../../../../tsp-output/server/js/src/generated/helpers/router.js";
import { participantsController } from "../participants.controller.js";
import { participantsService } from "../participants.service.js";

const originalService = { ...participantsService };

afterEach(() => {
  Object.assign(participantsService, originalService);
});

test("list delegates to service and returns participants", async () => {
  participantsService.listParticipants = async () => [participantAnswer()];
  const ctx = createContext();

  const result = await participantsController.list(ctx, "page-1");

  assert.ok(Array.isArray(result));
  assert.equal(result[0].id, "participant-1");
});

test("create returns 201 when participant is created", async () => {
  participantsService.createParticipant = async () => participantAnswer();
  const ctx = createContext();

  const result = await participantsController.create(ctx, "page-1", {
    name: "guest",
    canJoinRemotely: false,
    availableCandidateIds: [],
  });

  assert.equal(ctx.response.statusCode, 201);
  assert.ok("id" in result);
});

test("read maps service error to HTTP status", async () => {
  participantsService.readParticipant = async () => ({
    code: "NOT_FOUND",
    message: "Participant was not found.",
  });
  const ctx = createContext();

  const result = await participantsController.read(
    ctx,
    "page-1",
    "missing-participant",
  );

  assert.equal(ctx.response.statusCode, 404);
  assert.deepEqual(result, {
    code: "NOT_FOUND",
    message: "Participant was not found.",
  });
});

test("update and delete delegate to service", async () => {
  let updatedParticipantId: string | undefined;
  let deletedParticipantId: string | undefined;
  participantsService.updateParticipant = async (_pageId, participantId) => {
    updatedParticipantId = participantId;
    return participantAnswer();
  };
  participantsService.deleteParticipant = async (_pageId, participantId) => {
    deletedParticipantId = participantId;
  };

  await participantsController.update(
    createContext(),
    "page-1",
    "participant-1",
    {},
  );
  await participantsController.delete(
    createContext(),
    "page-1",
    "participant-1",
  );

  assert.equal(updatedParticipantId, "participant-1");
  assert.equal(deletedParticipantId, "participant-1");
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

function participantAnswer() {
  const now = Temporal.Instant.from("2026-05-31T10:00:00Z");

  return {
    id: "participant-1",
    name: "guest",
    canJoinRemotely: false,
    availableCandidateIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
