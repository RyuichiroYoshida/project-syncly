import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { pool } from "../../infra/mysql/pool.js";
import { createUlid } from "../../shared/ids.js";
import { toInstant, type MysqlDate } from "../../shared/mysql-date.js";
import type {
  CreateParticipantRequest,
  ErrorResponse,
  ParticipantAnswer,
  UpdateParticipantRequest,
} from "../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";

interface ParticipantRow extends RowDataPacket {
  id: string;
  name: string;
  can_join_remotely: number | boolean;
  comment: string | null;
  created_at: MysqlDate;
  updated_at: MysqlDate;
}

interface AvailabilityRow extends RowDataPacket {
  candidate_id: string;
}

type SqlValue = string | number | boolean | Date | null;

export async function listParticipants(
  pageId: string,
): Promise<ParticipantAnswer[] | ErrorResponse> {
  if (!(await pageExists(pageId))) {
    return notFound("Page was not found.");
  }

  const [rows] = await pool.query<ParticipantRow[]>(
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

  return Promise.all(rows.map((row) => toParticipantAnswer(pageId, row)));
}

export async function createParticipant(
  pageId: string,
  body: CreateParticipantRequest,
): Promise<ParticipantAnswer | ErrorResponse> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const participantId = createUlid();
    await connection.execute(
      `INSERT INTO page_participants (
        id,
        page_id,
        name,
        can_join_remotely,
        comment
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        participantId,
        pageId,
        body.name,
        body.canJoinRemotely,
        body.comment ?? null,
      ],
    );

    for (const candidateId of body.availableCandidateIds) {
      await connection.execute(
        `INSERT INTO participant_available_candidates (
          page_id,
          participant_id,
          candidate_id
        ) VALUES (?, ?, ?)`,
        [pageId, participantId, candidateId],
      );
    }

    await connection.commit();

    const participant = await getParticipant(pageId, participantId);
    return participant ?? notFound("Participant was not found after creation.");
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

export async function getParticipant(
  pageId: string,
  participantId: string,
): Promise<ParticipantAnswer | undefined> {
  const [rows] = await pool.query<ParticipantRow[]>(
    `SELECT
      id,
      name,
      can_join_remotely,
      comment,
      created_at,
      updated_at
    FROM page_participants
    WHERE page_id = ? AND id = ?`,
    [pageId, participantId],
  );

  const row = rows[0];
  return row === undefined ? undefined : toParticipantAnswer(pageId, row);
}

export async function readParticipant(
  pageId: string,
  participantId: string,
): Promise<ParticipantAnswer | ErrorResponse> {
  const participant = await getParticipant(pageId, participantId);
  return participant ?? notFound("Participant was not found.");
}

export async function updateParticipant(
  pageId: string,
  participantId: string,
  body: UpdateParticipantRequest,
): Promise<ParticipantAnswer | ErrorResponse> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updates: string[] = [];
    const params: SqlValue[] = [];

    if (body.name !== undefined) {
      updates.push("name = ?");
      params.push(body.name);
    }
    if (body.canJoinRemotely !== undefined) {
      updates.push("can_join_remotely = ?");
      params.push(body.canJoinRemotely);
    }
    if (body.comment !== undefined) {
      updates.push("comment = ?");
      params.push(body.comment);
    }

    if (updates.length > 0) {
      const [result] = await connection.execute(
        `UPDATE page_participants
        SET ${updates.join(", ")}
        WHERE page_id = ? AND id = ?`,
        [...params, pageId, participantId],
      );

      if ((result as ResultSetHeader).affectedRows === 0) {
        await connection.rollback();
        return notFound("Participant was not found.");
      }
    }

    if (body.availableCandidateIds !== undefined) {
      await connection.execute(
        `DELETE FROM participant_available_candidates
        WHERE page_id = ? AND participant_id = ?`,
        [pageId, participantId],
      );

      for (const candidateId of body.availableCandidateIds) {
        await connection.execute(
          `INSERT INTO participant_available_candidates (
            page_id,
            participant_id,
            candidate_id
          ) VALUES (?, ?, ?)`,
          [pageId, participantId, candidateId],
        );
      }
    }

    await connection.commit();

    const participant = await getParticipant(pageId, participantId);
    return participant ?? notFound("Participant was not found.");
  } catch (error) {
    await connection.rollback();
    return databaseError(error);
  } finally {
    connection.release();
  }
}

export async function deleteParticipant(
  pageId: string,
  participantId: string,
): Promise<void | ErrorResponse> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM page_participants
    WHERE page_id = ? AND id = ?`,
    [pageId, participantId],
  );

  if (result.affectedRows === 0) {
    return notFound("Participant was not found.");
  }
}

async function toParticipantAnswer(
  pageId: string,
  row: ParticipantRow,
): Promise<ParticipantAnswer> {
  const [availabilityRows] = await pool.query<AvailabilityRow[]>(
    `SELECT candidate_id
    FROM participant_available_candidates
    WHERE page_id = ? AND participant_id = ?
    ORDER BY created_at ASC`,
    [pageId, row.id],
  );

  return {
    id: row.id,
    name: row.name,
    canJoinRemotely: Boolean(row.can_join_remotely),
    comment: row.comment ?? undefined,
    availableCandidateIds: availabilityRows.map((availability) => availability.candidate_id),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  };
}

async function pageExists(pageId: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM pages WHERE id = ?`,
    [pageId],
  );

  return rows.length > 0;
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
