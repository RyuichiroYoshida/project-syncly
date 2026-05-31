import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { pool } from "../../infra/mysql/pool.js";
import { createUlid } from "../../shared/ids.js";
import { toInstant, toMysqlDate, type MysqlDate } from "../../shared/mysql-date.js";
import { hashEditPassword } from "../../shared/passwords.js";
import type {
  CandidateAvailabilitySummary,
  ConfirmPageRequest,
  CreatePageRequest,
  ErrorResponse,
  PageCandidate,
  PageConfirmation,
  PageDetail,
  PageRecord,
  ParticipantAnswer,
  UpdatePageRequest,
} from "../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";
import { PageStatus } from "../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";

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

interface CandidateRow extends RowDataPacket {
  id: string;
  candidate_at: MysqlDate;
  sort_order: number;
}

interface ConfirmationRow extends RowDataPacket {
  candidate_id: string;
  candidate_at: MysqlDate;
  confirmed_at: MysqlDate;
}

interface ParticipantRow extends RowDataPacket {
  id: string;
  name: string;
  can_join_remotely: number | boolean;
  comment: string | null;
  created_at: MysqlDate;
  updated_at: MysqlDate;
}

interface AvailabilityRow extends RowDataPacket {
  participant_id: string;
  candidate_id: string;
}

interface AvailabilitySummaryRow extends RowDataPacket {
  candidate_id: string;
  candidate_at: MysqlDate;
  available_count: number;
}

type Db = typeof pool;
type SqlValue = string | number | boolean | Date | null;

let db: Db = pool;

export function setPagesRepositoryDbForTest(testDb: Db): void {
  db = testDb;
}

export function resetPagesRepositoryDbForTest(): void {
  db = pool;
}

export async function createPage(
  body: CreatePageRequest,
): Promise<PageDetail | ErrorResponse> {
  if (body.candidates.length === 0) {
    return invalid("CreatePageRequest.candidates must not be empty.");
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const pageId = createUlid();
    await connection.execute(
      `INSERT INTO pages (
        id,
        owner_name,
        edit_password_hash,
        description,
        place,
        expires_at,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        pageId,
        body.ownerName,
        hashEditPassword(body.editPassword),
        body.description,
        body.place,
        toMysqlDate(body.expiresAt),
        PageStatus.Open,
      ],
    );

    await replaceCandidates(connection, pageId, body.candidates);
    await connection.commit();

    const detail = await getPageDetail(pageId);
    return detail ?? notFound("Page was not found after creation.");
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

export async function getPageDetail(pageId: string): Promise<PageDetail | undefined> {
  const [pageRows] = await db.query<PageRow[]>(
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
    FROM pages
    WHERE id = ?`,
    [pageId],
  );

  const page = pageRows[0];
  if (page === undefined) {
    return undefined;
  }

  const [candidateRows] = await db.query<CandidateRow[]>(
    `SELECT id, candidate_at, sort_order
    FROM page_datetime_candidates
    WHERE page_id = ?
    ORDER BY sort_order ASC, candidate_at ASC`,
    [pageId],
  );

  const [confirmationRows] = await db.query<ConfirmationRow[]>(
    `SELECT
      pc.candidate_id,
      pdc.candidate_at,
      pc.confirmed_at
    FROM page_confirmations pc
    INNER JOIN page_datetime_candidates pdc
      ON pdc.id = pc.candidate_id
      AND pdc.page_id = pc.page_id
    WHERE pc.page_id = ?`,
    [pageId],
  );

  const participants = await listParticipantAnswers(pageId);
  const availabilitySummary = await listAvailabilitySummary(pageId);

  return {
    page: toPageRecord(page),
    candidates: candidateRows.map(toPageCandidate),
    confirmation:
      confirmationRows[0] === undefined
        ? undefined
        : toPageConfirmation(confirmationRows[0]),
    participants,
    availabilitySummary,
  };
}

export async function updatePage(
  pageId: string,
  body: UpdatePageRequest,
): Promise<PageDetail | ErrorResponse> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const updates: string[] = [];
    const params: SqlValue[] = [];

    if (body.ownerName !== undefined) {
      updates.push("owner_name = ?");
      params.push(body.ownerName);
    }
    if (body.editPassword !== undefined) {
      updates.push("edit_password_hash = ?");
      params.push(hashEditPassword(body.editPassword));
    }
    if (body.description !== undefined) {
      updates.push("description = ?");
      params.push(body.description);
    }
    if (body.place !== undefined) {
      updates.push("place = ?");
      params.push(body.place);
    }
    if (body.expiresAt !== undefined) {
      updates.push("expires_at = ?");
      params.push(toMysqlDate(body.expiresAt));
    }

    if (updates.length > 0) {
      const [result] = await connection.execute(
        `UPDATE pages
        SET ${updates.join(", ")}
        WHERE id = ?`,
        [...params, pageId],
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        await connection.rollback();
        return notFound("Page was not found.");
      }
    }

    if (body.candidates !== undefined) {
      if (body.candidates.length === 0) {
        await connection.rollback();
        return invalid("UpdatePageRequest.candidates must not be empty.");
      }
      await replaceCandidates(connection, pageId, body.candidates);
    }

    await connection.commit();

    const detail = await getPageDetail(pageId);
    return detail ?? notFound("Page was not found.");
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

export async function deletePage(pageId: string): Promise<void | ErrorResponse> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE pages
    SET status = ?, deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP(6))
    WHERE id = ?`,
    [PageStatus.Deleted, pageId],
  );

  if (result.affectedRows === 0) {
    return notFound("Page was not found.");
  }
}

export async function confirmPage(
  pageId: string,
  body: ConfirmPageRequest,
): Promise<PageDetail | ErrorResponse> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [candidateRows] = await connection.query<RowDataPacket[]>(
      `SELECT id
      FROM page_datetime_candidates
      WHERE page_id = ? AND id = ?`,
      [pageId, body.candidateId],
    );

    if (candidateRows.length === 0) {
      await connection.rollback();
      return notFound("Candidate was not found on this page.");
    }

    await connection.execute(
      `INSERT INTO page_confirmations (page_id, candidate_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        candidate_id = VALUES(candidate_id),
        confirmed_at = CURRENT_TIMESTAMP(6)`,
      [pageId, body.candidateId],
    );

    await connection.execute(
      `UPDATE pages
      SET status = ?
      WHERE id = ?`,
      [PageStatus.Closed, pageId],
    );

    await connection.commit();

    const detail = await getPageDetail(pageId);
    return detail ?? notFound("Page was not found.");
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

export async function remindPage(pageId: string): Promise<void | ErrorResponse> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM pages WHERE id = ?`,
    [pageId],
  );

  if (rows.length === 0) {
    return notFound("Page was not found.");
  }
}

export async function listParticipantAnswers(
  pageId: string,
): Promise<ParticipantAnswer[]> {
  const [participantRows] = await db.query<ParticipantRow[]>(
    `SELECT
      id,
      name,
      can_join_remotely,
      comment,
      created_at,
      updated_at
    FROM page_participants
    WHERE page_id = ?
    ORDER BY created_at ASC`,
    [pageId],
  );

  const [availabilityRows] = await db.query<AvailabilityRow[]>(
    `SELECT participant_id, candidate_id
    FROM participant_available_candidates
    WHERE page_id = ?
    ORDER BY created_at ASC`,
    [pageId],
  );

  const candidateIdsByParticipantId = new Map<string, string[]>();
  for (const row of availabilityRows) {
    const values = candidateIdsByParticipantId.get(row.participant_id) ?? [];
    values.push(row.candidate_id);
    candidateIdsByParticipantId.set(row.participant_id, values);
  }

  return participantRows.map((row) => ({
    id: row.id,
    name: row.name,
    canJoinRemotely: Boolean(row.can_join_remotely),
    comment: row.comment ?? undefined,
    availableCandidateIds: candidateIdsByParticipantId.get(row.id) ?? [],
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  }));
}

async function listAvailabilitySummary(
  pageId: string,
): Promise<CandidateAvailabilitySummary[]> {
  const [rows] = await db.query<AvailabilitySummaryRow[]>(
    `SELECT
      pdc.id AS candidate_id,
      pdc.candidate_at,
      COUNT(pac.participant_id) AS available_count
    FROM page_datetime_candidates pdc
    LEFT JOIN participant_available_candidates pac
      ON pac.page_id = pdc.page_id
      AND pac.candidate_id = pdc.id
    WHERE pdc.page_id = ?
    GROUP BY pdc.id, pdc.candidate_at, pdc.sort_order
    ORDER BY pdc.sort_order ASC, pdc.candidate_at ASC`,
    [pageId],
  );

  return rows.map((row) => ({
    candidateId: row.candidate_id,
    candidateAt: toInstant(row.candidate_at),
    availableCount: Number(row.available_count),
  }));
}

async function replaceCandidates(
  connection: PoolConnection,
  pageId: string,
  candidates: CreatePageRequest["candidates"],
): Promise<void> {
  await connection.execute(
    `DELETE FROM page_datetime_candidates WHERE page_id = ?`,
    [pageId],
  );

  for (const [index, candidate] of candidates.entries()) {
    await connection.execute(
      `INSERT INTO page_datetime_candidates (
        id,
        page_id,
        candidate_at,
        sort_order
      ) VALUES (?, ?, ?, ?)`,
      [
        createUlid(),
        pageId,
        toMysqlDate(candidate.candidateAt),
        candidate.sortOrder ?? index,
      ],
    );
  }
}

function toPageRecord(row: PageRow): PageRecord {
  return {
    id: row.id,
    ownerName: row.owner_name,
    editPasswordHash: row.edit_password_hash ?? undefined,
    description: row.description,
    place: row.place,
    expiresAt: toInstant(row.expires_at),
    status: row.status,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
    deletedAt: row.deleted_at === null ? undefined : toInstant(row.deleted_at),
  };
}

function toPageCandidate(row: CandidateRow): PageCandidate {
  return {
    id: row.id,
    candidateAt: toInstant(row.candidate_at),
    sortOrder: row.sort_order,
  };
}

function toPageConfirmation(row: ConfirmationRow): PageConfirmation {
  return {
    candidateId: row.candidate_id,
    candidateAt: toInstant(row.candidate_at),
    confirmedAt: toInstant(row.confirmed_at),
  };
}

function invalid(message: string): ErrorResponse {
  return {
    code: "INVALID_REQUEST",
    message,
  };
}

function notFound(message: string): ErrorResponse {
  return {
    code: "NOT_FOUND",
    message,
  };
}

function databaseError(error: unknown): ErrorResponse {
  return {
    code: "DATABASE_ERROR",
    message: "Database operation failed.",
    details: error instanceof Error ? error.message : undefined,
  };
}
