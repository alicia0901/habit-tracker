# 習慣トラッカー (habit-tracker)

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
- ストリーク計算は「今日がまだ未達成でも、昨日までが連続していれば継続中とみなす」仕様(1日の途中でリセットされるのを防ぐため)。`routes/habits.js` の `computeStreak()` に集約
- `habit_logs` は `(habit_id, date)` にUNIQUE制約を張り、同じ日の重複記録を防止
- SQLiteはファイル1つで完結するため、外部DBサーバを立てずに素早く動かせる構成にした
