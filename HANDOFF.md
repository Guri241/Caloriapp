# Caloriapp 引き継ぎドキュメント（HANDOFF）

最終更新: 2026-07-02 / ブランチ: `claude/app-creation-spec-d5dyer`

このファイルは、Claude Code on the web（クラウド実行環境）で進めた作業を、
ローカル（VSCode等）や別セッションへ引き継ぐための状態メモです。

---

## 0. 一言サマリー

- **できていること**: モノレポ構成／バックエンドAPI（Next.js + Prisma）全実装／モバイルアプリ（Expo）全画面実装。型チェック・APIビルド・Metroバンドルまで確認済み。`main`ではなく作業ブランチにコミット＆プッシュ済み。
- **できていないこと（次にやる所）**: **Neonへのマイグレーション**と**API/アプリの実接続動作確認**。クラウド環境の通信ポリシーでDBへ到達できず未実施。→ **ローカルPCで実行すれば完了できる**（後述）。

---

## 1. プロジェクト概要

個人利用向けダイエット管理アプリ。体重・食事・運動の記録、目標管理、日次サマリー、ヘルスケア連携（将来）を備える。

- 要件定義: `dietapprequirements.md` 相当（体重/食事/目標がMVP、食品検索/運動/ヘルスケア連携/レポートが拡張）
- 配布想定: EAS Build による内部配布（ストア審査なし）

### 確定した設計判断（ユーザー選択済み）

| 項目 | 決定 |
|---|---|
| リポジトリ構成 | **モノレポ**（`apps/api` + `apps/mobile`、pnpm workspace） |
| 認証 | **簡易JWT**（bcrypt + jsonwebtoken、自前実装） |
| 食品DB連携 | **USDA FoodData Central API**（検索結果を共通Foodマスタにupsertしてキャッシュ） |
| DB | **Neon PostgreSQL**（Vercel Storage 経由で作成、中身はNeon） |
| APIホスティング想定 | Vercel |

---

## 2. 技術スタックと重要バージョン

### apps/api（バックエンド）
- Next.js `16.2.10`（App Router / Route Handlers / Turbopack）
- **Prisma `6.19.3`**（※重要: 後述の理由で7系ではなく6系に固定）
- @prisma/client `6.19.3`
- bcryptjs / jsonwebtoken / zod
- Node `22`, pnpm `10.34.3`

### apps/mobile（モバイル）
- Expo `~57.0.1` / React Native `0.86.0`
- expo-router（ファイルベースルーティング）
- TanStack Query（API通信・キャッシュ）
- expo-secure-store（JWTトークン保存）
- react-native-svg（体重推移グラフを自前実装）

---

## 3. リポジトリ構成

```
Caloriapp/
├── pnpm-workspace.yaml
├── package.json                 # ルート。pnpm.onlyBuiltDependencies に prisma等を登録
├── README.md
├── HANDOFF.md                   # このファイル
├── apps/
│   ├── api/                     # Next.js API Routes
│   │   ├── prisma/schema.prisma # 提供スキーマ（directUrl追加済み）
│   │   ├── .env.example         # 接続情報テンプレート
│   │   ├── src/lib/             # 共通ロジック
│   │   │   ├── prisma.ts        # PrismaClientシングルトン
│   │   │   ├── auth.ts          # hash/verify/signToken/requireAuth
│   │   │   ├── api-response.ts  # ApiError / handleApiError / jsonOk
│   │   │   ├── validation.ts    # zodスキーマ集
│   │   │   ├── daily-summary.ts # DailySummary再計算ロジック
│   │   │   ├── meal-log.ts      # 食事品目の栄養計算（Food参照/手入力）
│   │   │   └── usda.ts          # USDA API呼び出し・正規化
│   │   └── src/app/api/...      # 各エンドポイント（下記一覧）
│   └── mobile/                  # Expoアプリ
│       ├── app/                 # 画面（expo-router）
│       └── src/                 # api/ components/ context/ theme.ts 等
```

---

## 4. 実装済みAPIエンドポイント

すべて `Authorization: Bearer <token>` 必須（auth/register・auth/login を除く）。

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/auth/register` | 登録（JWT発行） |
| POST | `/api/auth/login` | ログイン（JWT発行） |
| GET/PATCH | `/api/auth/me` | プロフィール取得・更新 |
| GET/POST | `/api/weight-logs` | 体重記録 一覧・作成 |
| GET/PATCH/DELETE | `/api/weight-logs/[id]` | 体重記録 個別操作 |
| GET/POST | `/api/meal-logs` | 食事記録 一覧・作成（品目明細つき） |
| GET/PATCH/DELETE | `/api/meal-logs/[id]` | 食事記録 個別操作 |
| GET/POST | `/api/exercise-logs` | 運動記録 一覧・作成 |
| GET/PATCH/DELETE | `/api/exercise-logs/[id]` | 運動記録 個別操作 |
| GET/POST | `/api/goals` | 目標 一覧（進捗率つき）・作成（既存アクティブ目標を自動的に非アクティブ化） |
| GET/PATCH/DELETE | `/api/goals/[id]` | 目標 個別操作 |
| GET/POST | `/api/foods` | 食品マスタ 検索（共通＋自前）・自前登録 |
| GET/PATCH/DELETE | `/api/foods/[id]` | 食品 個別操作（自前のみ編集/削除可） |
| GET | `/api/foods/search?q=` | USDA検索→共通Foodにupsertして返す |
| GET | `/api/daily-summary?date= or from&to` | 日次サマリー（単日はその場で再計算） |
| GET/POST | `/api/health-logs` | ヘルスケア同期データ 取得・バッチupsert |

### ロジックの要点
- **DailySummary**: 記録の作成/更新/削除のたびに `recalcDailySummary(userId, date)` を呼び、摂取/消費/PFC/最新体重を再集計。日付は00:00(UTC)正規化。
- **MealLogItem 栄養計算**: `foodId`指定時はFoodの100gあたり値×`amountG`/`servingSizeG`で算出。手入力（foodIdなし）は栄養値を直接受け取る。`src/lib/meal-log.ts`。
- **USDA**: nutrient番号 208/203/204/205（cal/protein/fat/carbs）を抽出。`externalSource+externalId`で重複防止。

---

## 5. モバイルアプリ 実装済み画面

- 認証: `app/(auth)/login.tsx`, `register.tsx` + `src/context/AuthContext.tsx`（SecureStoreにトークン保存、起動時復元）
- タブ: `dashboard`(日次サマリー) / `weight`(記録+推移グラフ) / `meals`(食事一覧) / `goals`(目標・進捗) / `settings`
- モーダル的画面: `weight` からの記録追加、`meal-new`(食品検索/手入力), `exercise-new`, `goal-new`
- API層: `src/api/*.ts`（client.ts でベースURL・トークン付与・エラー整形）
- グラフ: `src/components/WeightChart.tsx`（react-native-svgで自前描画）

環境変数: `apps/mobile/.env.example` の `EXPO_PUBLIC_API_URL` にAPIのURL（実機からはPCのLAN IP）。

---

## 6. 現在の状態（検証レベル）

| 項目 | 状態 |
|---|---|
| API 型チェック（tsc） | ✅ パス |
| API 本番ビルド（next build） | ✅ 成功（全17ルート認識） |
| Prisma Client 生成 | ✅ 成功（v6.19.3） |
| Prisma マイグレーション（Neonへ反映） | ❌ **未実施**（DB到達不可） |
| API 実接続での動作確認 | ❌ **未実施** |
| モバイル 型チェック | ✅ パス |
| モバイル Metroバンドル | ✅ 成功 |
| モバイル 実機/シミュレータ起動 | ❌ 未実施 |
| git コミット | ✅ `49b5b28` |
| git プッシュ（作業ブランチ） | ✅ 済み |
| `prisma/migrations/` | まだ無し（初回migrateで生成される） |

---

## 7. ⚠️ ブロッカーと突破方法（最重要）

### 何が起きたか
クラウド実行環境（Claude Code on the web）の**外向き通信ポリシー**により、Neonデータベースへ到達できませんでした。

- TCP 5432（Postgres標準ポート）: 遮断
- Neonホストへの443: プロキシが **403（ポリシー拒否）**
- 結果: `prisma migrate` が `P1001 Can't reach database server ...:5432`

これは環境側の意図的なセキュリティ制限であり、コード側の問題ではありません。

### 突破方法 → **ローカルPCで実行する**
あなたのPC（VSCode等）は通常ネットワークなのでNeonに届きます。**ローカルで実行すれば、そのまま完了します**（特別な設定・MCP不要）。手順は次章。

---

## 8. 次にやること（ローカルでの再開手順）

```bash
# 1. 取得
git clone https://github.com/Guri241/Caloriapp.git   # 既にあるなら git pull
cd Caloriapp
git checkout claude/app-creation-spec-d5dyer
pnpm install

# 2. APIの環境変数
cd apps/api
cp .env.example .env
# .env を編集（Vercel Storage / Neon の値）:
#   DATABASE_URL = pooled（-pooler 入り）
#   DIRECT_URL   = unpooled（-pooler 無し）
#   JWT_SECRET   = $(openssl rand -base64 32) で生成した値
#   USDA_API_KEY = 任意（未設定だと /api/foods/search のみ利用不可）

# 3. マイグレーション（← 今回できなかった所。ローカルなら通る）
pnpm prisma:generate
pnpm prisma:migrate            # 初回は prisma/migrations/ が生成される

# 4. 起動
pnpm dev                       # http://localhost:3000
```

### 動作確認（別ターミナル）
```bash
# 登録
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"テスト"}'
# → 返ってきた token を控える

TOKEN=... # 上のレスポンスのtoken
# 体重記録
curl -X POST http://localhost:3000/api/weight-logs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"weightKg":70.5,"recordedAt":"2026-07-02T08:00:00.000Z"}'
# 日次サマリー
curl "http://localhost:3000/api/daily-summary?date=2026-07-02" \
  -H "Authorization: Bearer $TOKEN"
```

### モバイル起動
```bash
cd apps/mobile
cp .env.example .env
# EXPO_PUBLIC_API_URL を PCのLAN IP に（例: http://192.168.1.10:3000）
pnpm start            # Dev Client。ネイティブモジュール利用のためExpo Goでは一部不可
```

---

## 9. 環境固有の注意（ハマりどころ）

- **Prisma 6系に固定している理由**: 提供された `schema.prisma` は `datasource` 内に `url` / `directUrl` を書く旧方式。Prisma 7系はこれを廃止し `prisma.config.ts` へ移動する破壊的変更があるため、スキーマ非互換。6.19.3（旧方式が使える最新）を採用した。7系へ上げる場合はスキーマとクライアント初期化の書き換えが必要。
- **pnpm packageManager**: ルート `package.json` は `pnpm@10.34.3`。環境によっては別バージョンを要求されるが、10.34系で検証済み。
- **Prismaエンジンのダウンロード**: クラウド環境ではエンジンバイナリDLがTLSリセットで失敗し、手動配置で回避した経緯あり。ローカル（通常ネットワーク）では `pnpm install` / `prisma generate` が普通に通るはず。
- **Neon + pgbouncer**: `DATABASE_URL`（pooled）は実行時用、`DIRECT_URL`（unpooled）はマイグレーション用。schema.prismaは両方参照する設定済み。マイグレーションでpgbouncer関連の警告が出る場合はDIRECT_URLが正しく設定されているか確認。

---

## 10. セキュリティ注意（必ず対応推奨）

- 会話の過程で **Neonの接続文字列とパスワードが平文で共有された**。クラウド環境からは実接続できていないが、履歴に残るため **Neon/Vercel側でパスワードのローテーション（接続情報の再生成）を強く推奨**。
  - Vercel: Storage → 該当DB → Settings、または Neonコンソールの「Reset password」。
- ローテーション後は、ローカルの `apps/api/.env` を新しい接続文字列に更新すること。
- `.env` は `.gitignore` 済み（コミットされない）。`.env.example` のみリポジトリに含まれる。

---

## 11. 残タスク（要件定義書の拡張機能）

未着手。優先順は要件定義書に準拠。

1. HealthKit / Google Fit の実連携（`react-native-health` / `react-native-google-fit`。`app.json` に権限記述の追加が必要。Dev Client + EAS Build 前提）
2. 週次 / 月次レポート自動生成
3. EAS Build による実機への内部配布設定（`eas.json`）
4. （任意）作業ブランチ → デフォルトブランチへのプルリクエスト作成
5. （任意）Vercelへのデプロイ設定（`apps/api` をルートに、環境変数投入）

---

## 12. 参照

- ブランチ: `claude/app-creation-spec-d5dyer`（このブランチで開発継続）
- 直近コミット: `49b5b28 Add Caloriapp MVP: Next.js API backend + Expo mobile app`
- Claude Code on the web のネットワークポリシー: https://code.claude.com/docs/en/claude-code-on-the-web
- USDA APIキー取得: https://fdc.nal.usda.gov/api-key-signup.html
