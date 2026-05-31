import type {
  CreateParticipantRequest,
  Participants,
  UpdateParticipantRequest,
} from "../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";
import type { HttpContext } from "../../../tsp-output/server/js/src/generated/helpers/router.js";
import { isErrorResponse, statusCodeForError } from "../../shared/http-status.js";
import { participantsService } from "./participants.service.js";

export const participantsController: Participants<HttpContext> = {
  async list(ctx: HttpContext, pageId: string) {
    const result = await participantsService.listParticipants(pageId);
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },

  async create(
    ctx: HttpContext,
    pageId: string,
    body: CreateParticipantRequest,
  ) {
    const result = await participantsService.createParticipant(pageId, body);
    ctx.response.statusCode = isErrorResponse(result)
      ? statusCodeForError(result)
      : 201;
    return result;
  },

  async read(ctx: HttpContext, pageId: string, participantId: string) {
    const result = await participantsService.readParticipant(
      pageId,
      participantId,
    );
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },

  async update(
    ctx: HttpContext,
    pageId: string,
    participantId: string,
    body: UpdateParticipantRequest,
  ) {
    const result = await participantsService.updateParticipant(
      pageId,
      participantId,
      body,
    );
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },

  async delete(ctx: HttpContext, pageId: string, participantId: string) {
    const result = await participantsService.deleteParticipant(
      pageId,
      participantId,
    );
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },
};
