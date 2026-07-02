# Caloriapp

個人利用向けダイエット管理アプリ。体重・食事・運動の記録、目標管理を行う。
モノレポ構成で、バックエンドAPI (`apps/api`) とモバイルアプリ (`apps/mobile`) を管理する。

## 構成

```
apps/
  api/     Next.js API Routes (Vercelホスティング想定) + Prisma + Neon PostgreSQL
  mobile/  Expo (Dev Client) + expo-router + TanStack Query
```

- 認証: 簡易JWT（`jsonwebtoken` + `bcryptjs`、`Authorization: Bearer <token>`）
- 食品成分DB連携: USDA FoodData Central API（検索結果は`foods`テーブルにキャッシュされる）
- グラフ: `react-native-svg`を用いた自前の折れ線グラフ（体重推移）

## セットアップ

### 前提

- Node.js 22系 / pnpm 10系
- [Neon](https://neon.tech) のPostgreSQLプロジェクト（`DATABASE_URL`と direct connection用の`DIRECT_URL`）
- [USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html) のAPIキー

### インストール

```bash
pnpm install
```

### 1. バックエンドAPI (apps/api)

```bash
cd apps/api
cp .env.example .env
# .env にDATABASE_URL / DIRECT_URL / JWT_SECRET / USDA_API_KEY を設定

pnpm prisma:generate
pnpm prisma:migrate   # 初回マイグレーション作成・適用（開発環境）
pnpm dev              # http://localhost:3000 で起動
```

本番デプロイ（Vercel）では `pnpm prisma:deploy` でマイグレーションを適用する。

### 2. モバイルアプリ (apps/mobile)

Expo Goでは動作しない（ネイティブモジュールを使用するためDev Clientが必須）。

```bash
cd apps/mobile
cp .env.example .env
# .env の EXPO_PUBLIC_API_URL を実機からアクセス可能なAPIのURL（PCのLAN IPなど）に変更

pnpm start   # Dev Clientを起動（別途 expo run:ios / expo run:android でネイティブビルドが必要）
```

初回はネイティブビルドが必要:

```bash
pnpm ios      # または pnpm android
```

## APIエンドポイント一覧

すべて`/api/*`配下。認証必須のエンドポイントは`Authorization: Bearer <token>`ヘッダーが必要。

| メソッド | パス | 概要 |
|---|---|---|
| POST | `/api/auth/register` | 新規登録 |
| POST | `/api/auth/login` | ログイン |
| GET / PATCH | `/api/auth/me` | 自分のプロフィール取得・更新 |
| GET / POST | `/api/weight-logs` | 体重記録の一覧・作成 |
| GET / PATCH / DELETE | `/api/weight-logs/:id` | 体重記録の詳細・更新・削除 |
| GET / POST | `/api/meal-logs` | 食事記録の一覧・作成（品目を含む） |
| GET / PATCH / DELETE | `/api/meal-logs/:id` | 食事記録の詳細・更新・削除 |
| GET / POST | `/api/exercise-logs` | 運動記録の一覧・作成 |
| GET / PATCH / DELETE | `/api/exercise-logs/:id` | 運動記録の詳細・更新・削除 |
| GET / POST | `/api/goals` | 目標の一覧・新規設定（進捗率`progressPct`付き） |
| GET / PATCH / DELETE | `/api/goals/:id` | 目標の詳細・更新・削除 |
| GET / POST | `/api/foods` | 食品マスタのローカル検索・自前登録 |
| GET / PATCH / DELETE | `/api/foods/:id` | 食品の詳細・更新・削除（自前登録分のみ編集可） |
| GET | `/api/foods/search?q=` | USDA FoodData Centralを検索し、結果をFoodマスタにキャッシュ |
| GET | `/api/daily-summary?date=YYYY-MM-DD` | 指定日の摂取/消費カロリー・PFC集計（自動再計算） |
| GET | `/api/daily-summary?from=&to=` | 期間の日次サマリー一覧 |
| GET / POST | `/api/health-logs` | HealthKit/Google Fit同期データの一覧・バッチ同期 |

体重・食事・運動・ヘルスケアログの作成/更新/削除時に、該当日の`DailySummary`が自動的に再計算される。

## 実装済み機能

- 体重・体脂肪の記録とグラフ表示
- 食事記録（食品マスタ参照 or 手入力、品目複数対応）
- 目標設定と進捗率表示
- 食品マスタ検索（ローカル + USDA FoodData Central）
- 運動記録
- 日次サマリー自動計算（摂取/消費カロリー収支・PFC）

## 未実装（今後の拡張）

- HealthKit / Google Fit実連携（`react-native-health` / `react-native-google-fit`導入、`Info.plist`権限記述は`app.json`に用意済み）
- 週次/月次レポート自動生成
- EAS Buildでの内部配布設定

## 技術メモ

- Prisma: v6系を使用（v7で`datasource.url`/`directUrl`のschema記述がプラグイン方式に変更され互換性が崩れるため、提供されたschema.prismaの記法に合わせてv6系に固定）
- Next.js 16 / React 19 / TypeScript 6系
- Expo SDK 57 / expo-router / React Native 0.86
