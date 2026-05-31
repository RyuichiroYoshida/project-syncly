import { fileURLToPath } from "node:url";

import { pool } from "../infra/mysql/pool.js";
import {
  runPageMaintenanceBatch,
  type PageMaintenanceBatchResult,
} from "./page-maintenance.repository.js";

const DEFAULT_DELETED_PAGE_RETENTION_DAYS = 7;

export async function main(): Promise<PageMaintenanceBatchResult> {
  const deletedPageRetentionDays = readDeletedPageRetentionDays();
  const result = await runPageMaintenanceBatch({ deletedPageRetentionDays });

  console.log(
    JSON.stringify({
      expiredPages: result.expiredPages,
      hardDeletedPages: result.hardDeletedPages,
    }),
  );

  return result;
}

function readDeletedPageRetentionDays(): number {
  const rawValue = process.env.DELETED_PAGE_RETENTION_DAYS;
  if (rawValue === undefined || rawValue === "") {
    return DEFAULT_DELETED_PAGE_RETENTION_DAYS;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("DELETED_PAGE_RETENTION_DAYS must be a non-negative integer.");
  }

  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
