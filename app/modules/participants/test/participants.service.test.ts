import assert from "node:assert/strict";
import { test } from "node:test";

import { participantsService } from "../participants.service.js";

test("participantsService exposes participant use cases", () => {
  assert.equal(typeof participantsService.listParticipants, "function");
  assert.equal(typeof participantsService.createParticipant, "function");
  assert.equal(typeof participantsService.readParticipant, "function");
  assert.equal(typeof participantsService.updateParticipant, "function");
  assert.equal(typeof participantsService.deleteParticipant, "function");
});
