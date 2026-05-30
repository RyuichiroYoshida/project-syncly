import "@typespec/http";

using Http;

namespace SynclyService;

@route("/pages")
@tag("Pages")
interface Pages {
  /** 募集を作成する */
  @post
  create(@body body: CreatePageRequest): PageDetail | ErrorResponse;

  /** 募集IDに紐づく募集詳細を取得する */
  @route("{pageId}")
  @get
  read(@path pageId: Ulid): PageDetail | ErrorResponse;

  /** 募集情報と日時候補を更新する */
  @route("{pageId}")
  @patch
  update(
    @path pageId: Ulid,
    @body body: UpdatePageRequest
  ): PageDetail | ErrorResponse;

  /** 募集を論理削除する */
  @route("{pageId}")
  @delete
  delete(@path pageId: Ulid): void | ErrorResponse;

  /** 主催者が日時候補を確定し、募集状況をCLOSEDへ更新する */
  @route("{pageId}/confirmation")
  @put
  confirm(
    @path pageId: Ulid,
    @body body: ConfirmPageRequest
  ): PageDetail | ErrorResponse;

  /** OPENの募集についてDiscordへリマインドを送信する */
  @route("{pageId}/reminders")
  @post
  remind(@path pageId: Ulid): void | ErrorResponse;
}
