import type { ResultSetHeader } from "mysql2";

import { pool } from "../infra/mysql/pool.js";
import { PageStatus } from "../../tsp-output/server/js/src/generated/models/all/syncly-service.js";

const DEFAULT_DELETED_PAGE_RETENTION_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type Db = typeof pool;

let db: Db = pool;

export interface PageMaintenanceBatchOptions {
  now?: Date;
  deletedPageRetentionDays?: number;
}

export interface PageMaintenanceBatchResult {
  expiredPages: number;
  hardDeletedPages: number;
}

export function setPageMaintenanceBatchDbForTest(testDb: Db): void {
  db = testDb;
}

export function resetPageMaintenanceBatchDbForTest(): void {
  db = pool;
}

export async function runPageMaintenanceBatch(
  options: PageMaintenanceBatchOptions = {},
): Promise<PageMaintenanceBatchResult> {
  const now = options.now ?? new Date();
  const deletedPageRetentionDays =
    options.deletedPageRetentionDays ?? DEFAULT_DELETED_PAGE_RETENTION_DAYS;

  if (!Number.isInteger(deletedPageRetentionDays) || deletedPageRetentionDays < 0) {
    throw new Error("deletedPageRetentionDays must be a non-negative integer.");
  }

  const deletedBefore = new Date(
    now.getTime() - deletedPageRetentionDays * MILLISECONDS_PER_DAY,
  );

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [expiredResult] = await connection.execute<ResultSetHeader>(
      `UPDATE pages
      SET status = ?
      WHERE status = ? AND expires_at <= ?`,
      [PageStatus.Expired, PageStatus.Open, now],
    );

    const [deletedResult] = await connection.execute<ResultSetHeader>(
      `DELETE FROM pages
      WHERE status = ? AND deleted_at <= ?`,
      [PageStatus.Deleted, deletedBefore],
    );

    await connection.commit();

    return {
      expiredPages: expiredResult.affectedRows,
      hardDeletedPages: deletedResult.affectedRows,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
