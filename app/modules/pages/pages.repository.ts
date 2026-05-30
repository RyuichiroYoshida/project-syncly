import type { RowDataPacket } from "mysql2";

import { pool } from "../../infra/mysql/pool.js";
import { Page, PageStatus } from "./pages.types.js";

type MysqlDate = Date | string;

interface PageRow extends RowDataPacket {
  id: string;
  owner_name: string;
  edit_password_hash: string | null;
  description: string;
  place: string;
  expires_at: MysqlDate;
  status: PageStatus;
  created_at: MysqlDate;
  updated_at: MysqlDate;
  deleted_at: MysqlDate | null;
}

export async function getPages(): Promise<Page[]> {
  const [rows] = await pool.query<PageRow[]>(
    `SELECT
      id,
      owner_name,
      edit_password_hash,
      description,
      place,
      expires_at,
      status,
      created_at,
      updated_at,
      deleted_at
    FROM pages`,
  );

  return rows.map(toPage);
}

function toPage(row: PageRow): Page {
  return {
    id: row.id,
    ownerName: row.owner_name,
    editPasswordHash: row.edit_password_hash ?? undefined,
    description: row.description,
    place: row.place,
    expiresAt: toIsoString(row.expires_at),
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    deletedAt:
      row.deleted_at === null ? undefined : toIsoString(row.deleted_at),
  };
}

function toIsoString(value: MysqlDate): string {
  return value instanceof Date ? value.toISOString() : value;
}
