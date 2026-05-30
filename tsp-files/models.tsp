namespace SynclyService;

alias Ulid = string;

enum PageStatus {
  OPEN,
  CLOSED,
  EXPIRED,
  DELETED,
}

model PageRecord {
  /** 募集ID。ULID */
  id: Ulid;

  /** 主催者名 */
  ownerName: string;

  /** 募集編集用パスワードのハッシュ。パスワードなしの場合は未設定 */
  editPasswordHash?: string;

  /** 募集概要 */
  description: string;

  /** 募集場所。オンライン開催URLを含めてもよい */
  place: string;

  /** 募集終了日時。Asia/Tokyo 基準 */
  expiresAt: utcDateTime;

  /** 募集状況 */
  status: PageStatus;

  createdAt: utcDateTime;
  updatedAt: utcDateTime;

  /** 削除操作日時。DELETED の場合のみ設定する */
  deletedAt?: utcDateTime;
}

model PageDatetimeCandidateRecord {
  /** 日時候補ID。ULID */
  id: Ulid;

  /** 募集ID */
  pageId: Ulid;

  /** 募集日時候補。Asia/Tokyo 基準 */
  candidateAt: utcDateTime;

  /** 主催者が登録した候補の表示順 */
  sortOrder: int32;

  createdAt: utcDateTime;
}

model PageConfirmationRecord {
  /** 募集ID。主キー */
  pageId: Ulid;

  /** 確定した日時候補ID */
  candidateId: Ulid;

  /** 主催者が日時を確定した日時 */
  confirmedAt: utcDateTime;
}

model PageParticipantRecord {
  /** 参加者ID。ULID */
  id: Ulid;

  /** 募集ID */
  pageId: Ulid;

  /** 参加者名。同一募集内で重複不可 */
  name: string;

  /** リモート参加可否 */
  canJoinRemotely: boolean;

  /** 参加者コメント */
  comment?: string;

  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model ParticipantAvailableCandidateRecord {
  /** 募集ID */
  pageId: Ulid;

  /** 参加者ID */
  participantId: Ulid;

  /** 参加可能な日時候補ID */
  candidateId: Ulid;

  createdAt: utcDateTime;
}

model PageCandidateInput {
  /** 募集日時候補。Asia/Tokyo 基準 */
  candidateAt: utcDateTime;

  /** 表示順 */
  sortOrder?: int32;
}

model PageCandidate {
  id: Ulid;
  candidateAt: utcDateTime;
  sortOrder: int32;
}

model PageConfirmation {
  candidateId: Ulid;
  candidateAt: utcDateTime;
  confirmedAt: utcDateTime;
}

model CandidateAvailabilitySummary {
  candidateId: Ulid;
  candidateAt: utcDateTime;
  availableCount: int32;
}

model ParticipantAnswer {
  id: Ulid;
  name: string;
  canJoinRemotely: boolean;
  comment?: string;
  availableCandidateIds: Ulid[];
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model PageDetail {
  page: PageRecord;
  candidates: PageCandidate[];
  confirmation?: PageConfirmation;
  participants: ParticipantAnswer[];
  availabilitySummary: CandidateAvailabilitySummary[];
}

model CreatePageRequest {
  ownerName: string;
  editPassword?: string;
  description: string;
  place: string;
  expiresAt: utcDateTime;
  candidates: PageCandidateInput[];
}

model UpdatePageRequest {
  ownerName?: string;
  editPassword?: string;
  description?: string;
  place?: string;
  expiresAt?: utcDateTime;
  candidates?: PageCandidateInput[];
}

model ConfirmPageRequest {
  candidateId: Ulid;
}

model CreateParticipantRequest {
  name: string;
  canJoinRemotely: boolean;
  comment?: string;
  availableCandidateIds: Ulid[];
}

model UpdateParticipantRequest {
  name?: string;
  canJoinRemotely?: boolean;
  comment?: string;
  availableCandidateIds?: Ulid[];
}
