# テーブル定義

## 目的

`docs/OwnerPage.md` の募集情報と、`README.md` の参加者情報を MySQL に保存するためのテーブル定義をまとめる。

実行用DDLは [db/schema.sql](../db/schema.sql) に置く。

## 適用方法

SQLクライアントで `syncly` データベースを選択し、[db/schema.sql](../db/schema.sql) を実行する。

Docker Compose の MySQL コンテナへ適用する場合は、以下をプロジェクトルートで実行する。

```powershell
Get-Content db/schema.sql | docker-compose exec -T mysql mysql -usyncly -psyncly_password syncly
```

## 前提

- DB は MySQL 8.4 を想定する。
- ID はアプリケーション側で ULID を採番し、DB では `CHAR(26)` として保存する。
- 日時は `DATETIME(6)` で保存し、入力変換と表示は Asia/Tokyo 基準で扱う。
- 募集編集用パスワードは平文では保存せず、ハッシュ化した値を保存する。
- `edit_password_hash` が `NULL` の募集は、募集ページURLを知っている人を主催者相当として扱う。

## テーブル一覧

| テーブル | 用途 |
| --- | --- |
| `pages` | 募集本体。主催者名、概要、場所、募集終了日時、状態を持つ |
| `page_datetime_candidates` | 募集ごとの日時候補 |
| `page_confirmations` | 主催者が確定した日時候補 |
| `page_participants` | 募集ごとの参加者回答 |
| `participant_available_candidates` | 参加者が参加可能として選択した日時候補 |

## `pages`

募集IDごとに1行作成する。募集一覧表示は想定しないが、URL発行と募集ページ表示の起点になる。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| `id` | `CHAR(26)` | No | 募集ID。ULID |
| `owner_name` | `VARCHAR(100)` | No | 主催者名 |
| `edit_password_hash` | `VARCHAR(255)` | Yes | 募集編集用パスワードのハッシュ |
| `description` | `TEXT` | No | 募集概要 |
| `place` | `VARCHAR(255)` | No | 募集場所。オンライン開催URLを含めてもよい |
| `expires_at` | `DATETIME(6)` | No | 募集終了日時 |
| `status` | `ENUM('OPEN', 'CLOSED', 'EXPIRED', 'DELETED')` | No | 募集状況 |
| `created_at` | `DATETIME(6)` | No | 作成日時 |
| `updated_at` | `DATETIME(6)` | No | 更新日時 |
| `deleted_at` | `DATETIME(6)` | Yes | 削除操作日時。`DELETED` の場合のみ設定する |

`OPEN -> EXPIRED` はアプリケーション、またはバッチで `expires_at` を見て更新する。`DELETED` は論理削除として扱い、`deleted_at` から1週間経過した行を物理削除する。

## `page_datetime_candidates`

主催者が登録した募集日時候補を保存する。`MM-dd HH:mm` 入力はアプリケーション側で年と曜日を補完し、Asia/Tokyo の日時として保存する。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| `id` | `CHAR(26)` | No | 日時候補ID。ULID |
| `page_id` | `CHAR(26)` | No | 募集ID |
| `candidate_at` | `DATETIME(6)` | No | 日時候補 |
| `sort_order` | `INT UNSIGNED` | No | 表示順 |
| `created_at` | `DATETIME(6)` | No | 作成日時 |

同一募集内で同じ `candidate_at` は重複不可とする。

## `page_confirmations`

募集確定時に、確定した日時候補を1件だけ保存する。`pages.status` は確定操作時に `CLOSED` へ更新する。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| `page_id` | `CHAR(26)` | No | 募集ID。主キー |
| `candidate_id` | `CHAR(26)` | No | 確定した日時候補ID |
| `confirmed_at` | `DATETIME(6)` | No | 確定操作日時 |

`candidate_id` は同じ `page_id` に属する候補だけを参照できる。

## `page_participants`

参加者の回答本体を保存する。厳密なユーザー管理は行わず、同一募集内の参加者名だけを重複不可にする。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| `id` | `CHAR(26)` | No | 参加者ID。ULID |
| `page_id` | `CHAR(26)` | No | 募集ID |
| `name` | `VARCHAR(100)` | No | 参加者名 |
| `can_join_remotely` | `BOOLEAN` | No | リモート参加可否 |
| `comment` | `TEXT` | Yes | コメント |
| `created_at` | `DATETIME(6)` | No | 作成日時 |
| `updated_at` | `DATETIME(6)` | No | 更新日時 |

## `participant_available_candidates`

参加者が参加可能として選択した日時候補だけを保存する。参加者表では、このテーブルに行がない候補を参加不可として扱う。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| `page_id` | `CHAR(26)` | No | 募集ID |
| `participant_id` | `CHAR(26)` | No | 参加者ID |
| `candidate_id` | `CHAR(26)` | No | 参加可能な日時候補ID |
| `created_at` | `DATETIME(6)` | No | 作成日時 |

`participant_id` と `candidate_id` の組み合わせを主キーにする。`page_id` は、参加者と日時候補が同じ募集に属することをDB制約で保証するために持たせる。

## 集計

参加者表の末行に表示する日時候補ごとの参加可能人数は、`participant_available_candidates` を `candidate_id` ごとに集計する。

```sql
SELECT
  c.id,
  c.candidate_at,
  COUNT(a.participant_id) AS available_count
FROM page_datetime_candidates AS c
LEFT JOIN participant_available_candidates AS a
  ON a.candidate_id = c.id
  AND a.page_id = c.page_id
WHERE c.page_id = ?
GROUP BY c.id, c.candidate_at
ORDER BY c.sort_order, c.candidate_at;
```
