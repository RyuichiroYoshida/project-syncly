import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  createParticipant,
  deleteParticipant,
  listParticipants,
  resetParticipantsRepositoryDbForTest,
  setParticipantsRepositoryDbForTest,
  updateParticipant,
} from "../participants.repository.js";

afterEach(() => {
  resetParticipantsRepositoryDbForTest();
});

test("listParticipants returns NOT_FOUND when page does not exist", async () => {
  const { db } = createDb({ queryResults: [[]] });
  setParticipantsRepositoryDbForTest(db);

  const result = await listParticipants("missing-page");

  assert.deepEqual(result, {
    code: "NOT_FOUND",
    message: "Page was not found.",
  });
});

test("listParticipants maps participant rows with availability", async () => {
  const { db } = createDb({
    queryResults: [
      [{ id: "page-1" }],
      [
        {
          id: "participant-1",
          name: "guest",
          can_join_remotely: 1,
          comment: "comment",
          created_at: new Date("2026-05-31T10:00:00.000Z"),
          updated_at: new Date("2026-05-31T11:00:00.000Z"),
        },
      ],
      [{ candidate_id: "candidate-1" }],
    ],
  });
  setParticipantsRepositoryDbForTest(db);

  const result = await listParticipants("page-1");

  assert.ok(Array.isArray(result));
  assert.equal(result[0].id, "participant-1");
  assert.equal(result[0].canJoinRemotely, true);
  assert.deepEqual(result[0].availableCandidateIds, ["candidate-1"]);
});

test("createParticipant inserts participant and selected candidates", async () => {
  const connection = createConnection();
  const { db } = createDb({
    connection,
    queryResults: [
      [
        {
          id: "participant-created",
          name: "guest",
          can_join_remotely: 0,
          comment: null,
          created_at: new Date("2026-05-31T10:00:00.000Z"),
          updated_at: new Date("2026-05-31T10:00:00.000Z"),
        },
      ],
      [{ candidate_id: "candidate-1" }],
    ],
  });
  setParticipantsRepositoryDbForTest(db);

  const result = await createParticipant("page-1", {
    name: "guest",
    canJoinRemotely: false,
    availableCandidateIds: ["candidate-1"],
  });

  assert.ok("id" in result);
  assert.equal(result.id, "participant-created");
  assert.equal(connection.beginCount, 1);
  assert.equal(connection.commitCount, 1);
  assert.equal(connection.executeCalls.length, 2);
  assert.equal(connection.executeCalls[0].params?.[2], "guest");
  assert.equal(connection.executeCalls[1].params?.[2], "candidate-1");
});

test("updateParticipant replaces availability when provided", async () => {
  const connection = createConnection();
  const { db } = createDb({
    connection,
    queryResults: [
      [
        {
          id: "participant-1",
          name: "guest",
          can_join_remotely: 1,
          comment: "updated",
          created_at: new Date("2026-05-31T10:00:00.000Z"),
          updated_at: new Date("2026-05-31T11:00:00.000Z"),
        },
      ],
      [{ candidate_id: "candidate-2" }],
    ],
  });
  setParticipantsRepositoryDbForTest(db);

  const result = await updateParticipant("page-1", "participant-1", {
    comment: "updated",
    availableCandidateIds: ["candidate-2"],
  });

  assert.ok("id" in result);
  assert.equal(result.availableCandidateIds[0], "candidate-2");
  assert.equal(connection.executeCalls.length, 3);
  assert.match(connection.executeCalls[1].sql, /DELETE FROM participant_available_candidates/);
  assert.equal(connection.executeCalls[2].params?.[2], "candidate-2");
});

test("deleteParticipant returns NOT_FOUND when no row was deleted", async () => {
  const { db } = createDb({
    executeResults: [{ affectedRows: 0 }],
  });
  setParticipantsRepositoryDbForTest(db);

  const result = await deleteParticipant("page-1", "missing-participant");

  assert.deepEqual(result, {
    code: "NOT_FOUND",
    message: "Participant was not found.",
  });
});

function createDb(options: {
  queryResults?: unknown[][];
  executeResults?: Array<Record<string, unknown>>;
  connection?: ReturnType<typeof createConnection>;
} = {}) {
  const queryResults = [...(options.queryResults ?? [])];
  const executeResults = [...(options.executeResults ?? [])];
  const connection = options.connection ?? createConnection();

  return {
    db: {
      async query() {
        return [queryResults.shift() ?? [], []];
      },
      async execute() {
        return [executeResults.shift() ?? { affectedRows: 1 }, []];
      },
      async getConnection() {
        return connection;
      },
    } as never,
  };
}

function createConnection() {
  return {
    beginCount: 0,
    commitCount: 0,
    rollbackCount: 0,
    releaseCount: 0,
    executeCalls: [] as Array<{ sql: string; params?: unknown[] }>,
    async beginTransaction() {
      this.beginCount += 1;
    },
    async commit() {
      this.commitCount += 1;
    },
    async rollback() {
      this.rollbackCount += 1;
    },
    release() {
      this.releaseCount += 1;
    },
    async execute(sql: string, params?: unknown[]) {
      this.executeCalls.push({ sql, params });
      return [{ affectedRows: 1 }, []];
    },
  };
}
