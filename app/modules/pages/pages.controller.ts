import type {
  ConfirmPageRequest,
  CreatePageRequest,
  Pages,
  UpdatePageRequest,
} from "../../../tsp-output/server/js/src/generated/models/all/syncly-service.js";
import type { HttpContext } from "../../../tsp-output/server/js/src/generated/helpers/router.js";
import { isErrorResponse, statusCodeForError } from "../../shared/http-status.js";
import { pagesService } from "./pages.service.js";

export const pagesController: Pages<HttpContext> = {
  async create(ctx: HttpContext, body: CreatePageRequest) {
    const result = await pagesService.createPage(body);
    ctx.response.statusCode = isErrorResponse(result)
      ? statusCodeForError(result)
      : 201;
    return result;
  },

  async read(ctx: HttpContext, pageId: string) {
    const result = await pagesService.getPageDetail(pageId);
    if (result === undefined) {
      ctx.response.statusCode = 404;
      return {
        code: "NOT_FOUND",
        message: "Page was not found.",
      };
    }

    return result;
  },

  async update(ctx: HttpContext, pageId: string, body: UpdatePageRequest) {
    const result = await pagesService.updatePage(pageId, body);
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },

  async delete(ctx: HttpContext, pageId: string) {
    const result = await pagesService.deletePage(pageId);
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },

  async confirm(ctx: HttpContext, pageId: string, body: ConfirmPageRequest) {
    const result = await pagesService.confirmPage(pageId, body);
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },

  async remind(ctx: HttpContext, pageId: string) {
    const result = await pagesService.remindPage(pageId);
    if (isErrorResponse(result)) {
      ctx.response.statusCode = statusCodeForError(result);
    }
    return result;
  },
};
