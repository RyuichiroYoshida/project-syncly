CREATE TABLE IF NOT EXISTS pages (
  id CHAR(26) NOT NULL COMMENT 'ULID',
  owner_name VARCHAR(100) NOT NULL COMMENT '主催者名',
  edit_password_hash VARCHAR(255) NULL COMMENT '募集編集用パスワードのハッシュ。NULL の場合はパスワードなし',
  description TEXT NOT NULL COMMENT '募集概要',
  place VARCHAR(255) NOT NULL COMMENT '募集場所',
  expires_at DATETIME(6) NOT NULL COMMENT '募集終了日時。Asia/Tokyo 基準',
  status ENUM('OPEN', 'CLOSED', 'EXPIRED', 'DELETED') NOT NULL DEFAULT 'OPEN' COMMENT '募集状況',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL COMMENT '削除操作日時。DELETED の場合のみ設定する',
  PRIMARY KEY (id),
  KEY idx_pages_status_expires_at (status, expires_at),
  KEY idx_pages_deleted_at (deleted_at),
  CONSTRAINT chk_pages_deleted_at CHECK (
    (status = 'DELETED' AND deleted_at IS NOT NULL)
    OR (status <> 'DELETED' AND deleted_at IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='募集';

CREATE TABLE IF NOT EXISTS page_datetime_candidates (
  id CHAR(26) NOT NULL COMMENT 'ULID',
  page_id CHAR(26) NOT NULL,
  candidate_at DATETIME(6) NOT NULL COMMENT '募集日時候補。Asia/Tokyo 基準',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '主催者が登録した候補の表示順',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_page_datetime_candidates_page_candidate (page_id, candidate_at),
  UNIQUE KEY uq_page_datetime_candidates_id_page (id, page_id),
  KEY idx_page_datetime_candidates_page_order (page_id, sort_order),
  CONSTRAINT fk_page_datetime_candidates_page
    FOREIGN KEY (page_id) REFERENCES pages (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='募集日時候補';

CREATE TABLE IF NOT EXISTS page_confirmations (
  page_id CHAR(26) NOT NULL,
  candidate_id CHAR(26) NOT NULL,
  confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '主催者が日時を確定した日時',
  PRIMARY KEY (page_id),
  KEY idx_page_confirmations_candidate_page (candidate_id, page_id),
  CONSTRAINT fk_page_confirmations_page
    FOREIGN KEY (page_id) REFERENCES pages (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_page_confirmations_candidate
    FOREIGN KEY (candidate_id, page_id) REFERENCES page_datetime_candidates (id, page_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='募集日時確定';

CREATE TABLE IF NOT EXISTS page_participants (
  id CHAR(26) NOT NULL COMMENT 'ULID',
  page_id CHAR(26) NOT NULL,
  name VARCHAR(100) NOT NULL COMMENT '参加者名。同一募集内で重複不可',
  can_join_remotely BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'リモート参加可否',
  comment TEXT NULL COMMENT '参加者コメント',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_page_participants_page_name (page_id, name),
  UNIQUE KEY uq_page_participants_id_page (id, page_id),
  CONSTRAINT fk_page_participants_page
    FOREIGN KEY (page_id) REFERENCES pages (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='参加者';

CREATE TABLE IF NOT EXISTS participant_available_candidates (
  page_id CHAR(26) NOT NULL,
  participant_id CHAR(26) NOT NULL,
  candidate_id CHAR(26) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (participant_id, candidate_id),
  KEY idx_participant_available_candidates_participant_page (participant_id, page_id),
  KEY idx_participant_available_candidates_candidate_page (candidate_id, page_id),
  CONSTRAINT fk_participant_available_candidates_participant
    FOREIGN KEY (participant_id, page_id) REFERENCES page_participants (id, page_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_participant_available_candidates_candidate
    FOREIGN KEY (candidate_id, page_id) REFERENCES page_datetime_candidates (id, page_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='参加可能な日時候補';
