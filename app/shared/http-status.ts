import type { ErrorResponse } from "../../tsp-output/server/js/src/generated/models/all/syncly-service.js";

export function statusCodeForError(error: ErrorResponse): number {
  switch (error.code) {
    case "INVALID_REQUEST":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "DATABASE_ERROR":
      return 500;
    default:
      return 500;
  }
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value
  );
}
