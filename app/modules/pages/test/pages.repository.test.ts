import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { Temporal } from "temporal-polyfill";

import { PageStatus } from "../../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";
import {
  createPage,
  deletePage,
  getPageDetail,
  remindPage,
  resetPagesRepositoryDbForTest,
  setPagesRepositoryDbForTest,
  updatePage,
} from "../pages.repository.js";

afterEach(() => {
  resetPagesRepositoryDbForTest();
});

test("getPageDetail maps page aggregate rows to generated API model", async () => {
  const { db } = createDb({
    queryResults: [
      [
        {
          id: "page-1",
          owner_name: "owner",
          edit_password_hash: null,
          description: "description",
          place: "room",
          expires_at: new Date("2026-06-01T10:00:00.000Z"),
          status: PageStatus.Open,
          created_at: new Date("2026-05-31T10:00:00.000Z"),
          updated_at: new Date("2026-05-31T11:00:00.000Z"),
          deleted_at: null,
        },
      ],
      [
        {
          id: "candidate-1",
          candidate_at: new Date("2026-06-02T10:00:00.000Z"),
          sort_order: 0,
        },
      ],
      [
        {
          candidate_id: "candidate-1",
          candidate_at: new Date("2026-06-02T10:00:00.000Z"),
          confirmed_at: new Date("2026-06-01T12:00:00.000Z"),
        },
      ],
      [
        {
          id: "participant-1",
          name: "guest",
          can_join_remotely: 1,
          comment: null,
          created_at: new Date("2026-05-31T12:00:00.000Z"),
          updated_at: new Date("2026-05-31T12:30:00.000Z"),
        },
      ],
      [{ participant_id: "participant-1", candidate_id: "candidate-1" }],
      [
        {
          candidate_id: "candidate-1",
          candidate_at: new Date("2026-06-02T10:00:00.000Z"),
          available_count: 1,
        },
      ],
    ],
  });
  setPagesRepositoryDbForTest(db);

  const detail = await getPageDetail("page-1");

  assert.equal(detail?.page.id, "page-1");
  assert.equal(detail?.page.ownerName, "owner");
  assert.equal(detail?.page.expiresAt.toString(), "2026-06-01T10:00:00Z");
  assert.equal(detail?.candidates[0].candidateAt.toString(), "2026-06-02T10:00:00Z");
  assert.equal(detail?.confirmation?.candidateId, "candidate-1");
  assert.equal(detail?.participants[0].availableCandidateIds[0], "candidate-1");
  assert.equal(detail?.availabilitySummary[0].availableCount, 1);
});

test("createPage inserts page and candidates in a transaction", async () => {
  const connection = createConnection();
  const { db } = createDb({
    connection,
    queryResults: [
      [
        {
          id: "page-created",
          owner_name: "owner",
          edit_password_hash: null,
          description: "description",
          place: "room",
          expires_at: new Date("2026-06-01T10:00:00.000Z"),
          status: PageStatus.Open,
          created_at: new Date("2026-05-31T10:00:00.000Z"),
          updated_at: new Date("2026-05-31T10:00:00.000Z"),
          deleted_at: null,
        },
      ],
      [],
      [],
      [],
      [],
      [],
    ],
  });
  setPagesRepositoryDbForTest(db);

  const result = await createPage({
    ownerName: "owner",
    description: "description",
    place: "room",
    expiresAt: Temporal.Instant.from("2026-06-01T10:00:00Z"),
    candidates: [
      { candidateAt: Temporal.Instant.from("2026-06-02T10:00:00Z") },
      {
        candidateAt: Temporal.Instant.from("2026-06-03T10:00:00Z"),
        sortOrder: 10,
      },
    ],
  });

  assert.ok("page" in result);
  assert.equal(result.page.id, "page-created");
  assert.equal(connection.beginCount, 1);
  assert.equal(connection.commitCount, 1);
  assert.equal(connection.rollbackCount, 0);
  assert.equal(connection.executeCalls.length, 4);
  assert.equal(connection.executeCalls[0].params?.[6], PageStatus.Open);
  assert.match(connection.executeCalls[1].sql, /DELETE FROM page_datetime_candidates/);
  assert.equal(connection.executeCalls[2].params?.[3], 0);
  assert.equal(connection.executeCalls[3].params?.[3], 10);
});

test("updatePage rejects empty candidate replacement and rolls back", async () => {
  const connection = createConnection();
  const { db } = createDb({ connection });
  setPagesRepositoryDbForTest(db);

  const result = await updatePage("page-1", { candidates: [] });

  assert.deepEqual(result, {
    code: "INVALID_REQUEST",
    message: "UpdatePageRequest.candidates must not be empty.",
  });
  assert.equal(connection.rollbackCount, 1);
  assert.equal(connection.commitCount, 0);
});

test("deletePage returns NOT_FOUND when no page was updated", async () => {
  const { db } = createDb({
    executeResults: [{ affectedRows: 0 }],
  });
  setPagesRepositoryDbForTest(db);

  const result = await deletePage("missing-page");

  assert.deepEqual(result, {
    code: "NOT_FOUND",
    message: "Page was not found.",
  });
});

test("remindPage only checks that the page exists for now", async () => {
  const success = createDb({ queryResults: [[{ id: "page-1" }]] });
  setPagesRepositoryDbForTest(success.db);

  assert.equal(await remindPage("page-1"), undefined);

  const missing = createDb({ queryResults: [[]] });
  setPagesRepositoryDbForTest(missing.db);

  assert.deepEqual(await remindPage("missing-page"), {
    code: "NOT_FOUND",
    message: "Page was not found.",
  });
});

function createDb(options: {
  queryResults?: unknown[][];
  executeResults?: Array<Record<string, unknown>>;
  connection?: ReturnType<typeof createConnection>;
} = {}) {
  const queryResults = [...(options.queryResults ?? [])];
  const executeResults = [...(options.executeResults ?? [])];
  const queryCalls: Array<{ sql: string; params?: unknown[] }> = [];
  const executeCalls: Array<{ sql: string; params?: unknown[] }> = [];
  const connection = options.connection ?? createConnection();

  return {
    db: {
      async query(sql: string, params?: unknown[]) {
        queryCalls.push({ sql, params });
        return [queryResults.shift() ?? [], []];
      },
      async execute(sql: string, params?: unknown[]) {
        executeCalls.push({ sql, params });
        return [executeResults.shift() ?? { affectedRows: 1 }, []];
      },
      async getConnection() {
        return connection;
      },
    } as never,
    queryCalls,
    executeCalls,
    connection,
  };
}

function createConnection() {
  return {
    beginCount: 0,
    commitCount: 0,
    rollbackCount: 0,
    releaseCount: 0,
    executeCalls: [] as Array<{ sql: string; params?: unknown[] }>,
    queryCalls: [] as Array<{ sql: string; params?: unknown[] }>,
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
    async query(sql: string, params?: unknown[]) {
      this.queryCalls.push({ sql, params });
      return [[], []];
    },
  };
}
