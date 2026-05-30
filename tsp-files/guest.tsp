import "@typespec/http";

using Http;

namespace SynclyService;

@route("/pages/{pageId}/participants")
@tag("Participants")
interface Participants {
  /** 募集ごとの参加者回答を取得する */
  @get
  list(@path pageId: Ulid): ParticipantAnswer[] | ErrorResponse;

  /** 参加者回答を作成する */
  @post
  create(
    @path pageId: Ulid,
    @body body: CreateParticipantRequest
  ): ParticipantAnswer | ErrorResponse;

  /** 参加者回答を取得する */
  @route("{participantId}")
  @get
  read(
    @path pageId: Ulid,
    @path participantId: Ulid
  ): ParticipantAnswer | ErrorResponse;

  /** OPENの募集に対する参加者回答を更新する */
  @route("{participantId}")
  @patch
  update(
    @path pageId: Ulid,
    @path participantId: Ulid,
    @body body: UpdateParticipantRequest
  ): ParticipantAnswer | ErrorResponse;

  /** 参加者回答を削除する */
  @route("{participantId}")
  @delete
  delete(
    @path pageId: Ulid,
    @path participantId: Ulid
  ): void | ErrorResponse;
}
