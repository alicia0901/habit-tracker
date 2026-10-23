# 習慣トラッカー (habit-tracker)

[![test](https://github.com/alicia0901/habit-tracker/actions/workflows/test.yml/badge.svg)](https://github.com/alicia0901/habit-tracker/actions/workflows/test.yml)

日々の習慣を記録し、連続達成日数(ストリーク)と直近30日の達成状況をヒートマップで可視化するWebアプリ。

## 特徴

- ユーザー登録・ログイン(JWT認証)。習慣データはユーザーごとに分離
- 習慣の追加・今日の達成チェック・削除
- 現在のストリーク(継続日数)と最長ストリークをサーバ側で算出
- 直近30日分の達成状況をヒートマップ表示

## 技術スタック

- Node.js + Express (REST API)
- better-sqlite3 (同期API・ファイルベースのSQLite)
- jsonwebtoken + bcryptjs (トークン認証・パスワードハッシュ化)
- フロントエンドはビルド不要のバニラJS/CSS

## セットアップ

```bash
npm install
npm start
# http://localhost:3000
```

| 環境変数 | 既定値 | 内容 |
| --- | --- | --- |
| `PORT` | `3000` | 待ち受けポート |
| `JWT_SECRET` | `dev-secret-change-me` | トークン署名鍵。`NODE_ENV=production` では未設定だと起動を拒否する |
| `DB_PATH` | `./data.sqlite` | SQLiteファイルのパス(`:memory:` も可) |
| `APP_TIMEZONE` | `Asia/Tokyo` | 「今日」を判定するタイムゾーン |

## デプロイ (Render)

`render.yaml`(Render Blueprint)を同梱している。Renderのダッシュボードで **New → Blueprint** からこのリポジトリを選ぶと、以下の設定でWebサービスが作られる。

- `npm ci` でビルドし `npm start` で起動、`/healthz` でヘルスチェック
- `NODE_ENV=production`、`JWT_SECRET` はRenderがランダム値を自動生成(リポジトリに秘密鍵を置かない)

無料プランはディスクが永続化されないため、再起動・再デプロイ・一定時間アクセスが無いときのスリープ復帰でSQLiteのデータは消える(デモ用途として許容し、ログイン画面に明記している)。データを残したい場合は有料プランの永続ディスクを `DB_PATH` に指定する。

公開環境向けに以下の対策を入れている。

- 登録・ログインAPIはIPごとに15分20回までのレート制限(総当たりとbcrypt計算による負荷を抑止)
- ユーザー名32文字・パスワード8〜128文字・習慣名100文字・リクエストボディ10KBの上限

## テスト

```bash
npm test
```

Node.js標準の `node:test` のみで動作し、追加のテストライブラリは使っていない。push/PRごとにGitHub Actions(Node 20/22)で実行される。

- `test/streak.test.js` — ストリーク計算(途切れ・月またぎ・今日未達成時の扱い)
- `test/date.test.js` — タイムゾーン境界(JST 0時/9時)・月末/うるう年・日付形式チェック
- `test/api.test.js` — インメモリDBでサーバを起動し、認証・CRUD・他ユーザーのデータへのアクセス拒否までをHTTP経由で検証
- `test/security.test.js` — 本番で `JWT_SECRET` 未設定時に起動を拒否すること・ログインのレート制限

## API概要

| メソッド | パス | 内容 |
| --- | --- | --- |
| POST | /api/auth/register | ユーザー登録 |
| POST | /api/auth/login | ログイン |
| GET | /api/habits | 自分の習慣一覧(ストリーク込み) |
| POST | /api/habits | 習慣を追加 |
| DELETE | /api/habits/:id | 習慣を削除 |
| POST | /api/habits/:id/toggle | 指定日(既定: 今日)の達成/未達成を切り替え |
| GET | /api/habits/:id/logs?days=30 | 直近N日分の達成状況 |

## 設計メモ

- 認証はセッションを持たないステートレスなJWT方式。`Authorization: Bearer <token>` ヘッダで検証する
- ストリーク計算は「今日がまだ未達成でも、昨日までが連続していれば継続中とみなす」仕様(1日の途中でリセットされるのを防ぐため)。DBに依存しない純粋関数 `lib/streak.js` の `computeStreak()` に切り出し、単体テストしやすくしている
- 「今日」はサーバのUTCではなく `APP_TIMEZONE`(既定: 日本時間)で判定する。UTC基準だと日本時間0〜9時の記録が前日扱いになるため(`lib/date.js`)
- アプリ本体(`app.js`)と起動処理(`server.js`)を分け、テストからはポートを自動割り当てしてサーバを立ち上げられるようにしている
- `habit_logs` は `(habit_id, date)` にUNIQUE制約を張り、同じ日の重複記録を防止
- SQLiteはファイル1つで完結するため、外部DBサーバを立てずに素早く動かせる構成にした
