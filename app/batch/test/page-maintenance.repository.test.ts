import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { PageStatus } from "../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";
import {
  resetPageMaintenanceBatchDbForTest,
  runPageMaintenanceBatch,
  setPageMaintenanceBatchDbForTest,
} from "../page-maintenance.repository.js";

afterEach(() => {
  resetPageMaintenanceBatchDbForTest();
});

test("runPageMaintenanceBatch expires open pages and hard-deletes old deleted pages", async () => {
  const connection = createConnection({
    executeResults: [{ affectedRows: 2 }, { affectedRows: 3 }],
  });
  const { db } = createDb(connection);
  setPageMaintenanceBatchDbForTest(db);

  const now = new Date("2026-06-01T00:00:00.000Z");
  const result = await runPageMaintenanceBatch({
    now,
    deletedPageRetentionDays: 7,
  });

  assert.deepEqual(result, {
    expiredPages: 2,
    hardDeletedPages: 3,
  });
  assert.equal(connection.beginCount, 1);
  assert.equal(connection.commitCount, 1);
  assert.equal(connection.rollbackCount, 0);
  assert.match(connection.executeCalls[0].sql, /UPDATE pages/);
  assert.deepEqual(connection.executeCalls[0].params, [
    PageStatus.Expired,
    PageStatus.Open,
    now,
  ]);
  assert.match(connection.executeCalls[1].sql, /DELETE FROM pages/);
  assert.deepEqual(connection.executeCalls[1].params, [
    PageStatus.Deleted,
    new Date("2026-05-25T00:00:00.000Z"),
  ]);
});

test("runPageMaintenanceBatch rolls back when a database operation fails", async () => {
  const failure = new Error("database failed");
  const connection = createConnection({ executeError: failure });
  const { db } = createDb(connection);
  setPageMaintenanceBatchDbForTest(db);

  await assert.rejects(
    () => runPageMaintenanceBatch({ now: new Date("2026-06-01T00:00:00.000Z") }),
    failure,
  );

  assert.equal(connection.commitCount, 0);
  assert.equal(connection.rollbackCount, 1);
  assert.equal(connection.releaseCount, 1);
});

test("runPageMaintenanceBatch rejects invalid deleted page retention days", async () => {
  const connection = createConnection();
  const { db } = createDb(connection);
  setPageMaintenanceBatchDbForTest(db);

  await assert.rejects(
    () =>
      runPageMaintenanceBatch({
        deletedPageRetentionDays: -1,
      }),
    /deletedPageRetentionDays must be a non-negative integer/,
  );

  assert.equal(connection.beginCount, 0);
});

function createDb(connection: ReturnType<typeof createConnection>) {
  return {
    db: {
      async getConnection() {
        return connection;
      },
    } as never,
  };
}

function createConnection(options: {
  executeResults?: Array<Record<string, unknown>>;
  executeError?: Error;
} = {}) {
  const executeResults = [...(options.executeResults ?? [])];

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
      if (options.executeError !== undefined) {
        throw options.executeError;
      }

      this.executeCalls.push({ sql, params });
      return [executeResults.shift() ?? { affectedRows: 1 }, []];
    },
  };
}
