import assert from "node:assert/strict";
import { test } from "node:test";

import type { Participant } from "../participants.types.js";

test("Participant type carries participant answer fields", () => {
  const participant: Participant = {
    id: "participant-1",
    name: "guest",
    canJoinRemotely: true,
    comment: "comment",
    availableCandidateIds: ["candidate-1"],
    createdAt: "2026-05-31T10:00:00Z",
    updatedAt: "2026-05-31T11:00:00Z",
  };

  assert.equal(participant.name, "guest");
  assert.deepEqual(participant.availableCandidateIds, ["candidate-1"]);
});
