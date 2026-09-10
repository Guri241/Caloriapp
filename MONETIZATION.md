# Caloriapp 収益化ドキュメント

最終更新: 2026-09-10 / ブランチ: `claude/pensive-cannon-m7l1mh`

個人利用アプリだったCaloriappを、収益を生む製品にするために行った市場調査・戦略判断・実装をまとめる。
**先に読むべき結論は「4. ユニットエコノミクス」にある。** 現在の価格設定は、解析モデルの選択次第で粗利が赤字になる。

---

## 1. 市場調査サマリー

### 市場規模
- カロリーカウンター系アプリの世界市場は2026年時点で約41.4億ドル、2034年に84.1億ドル（CAGR 9.27%）。
- 国内は「あすけん」「カロミル」等が牽引し、利用者は1,300万人以上。

### 価格の相場（国内）
| サービス | 有料プラン価格 |
|---|---|
| あすけん | 月額480円（税込） |
| カロミル | 月額約400円 |

国内相場は**月額400〜480円**。ここが価格の天井として効く。

### この2年で何が起きたか — Cal AIの事例
- 2024年5月ローンチ。写真を撮るだけで栄養推定するアプリ。
- 18ヶ月で0→$50M ARR。1,500万DL超。2025年12月にMyFitnessPalが買収。
- 価格は**$2.49/月 または $29.99/年**（年額は月あたり約$2.5＝約375円）。

**勝因は技術ではなく流通:**
- インフルエンサー250人に固定リテイナーを払い、TikTok/Instagramで継続露出。月あたりの投下額は数十万ドル規模。
- 18ヶ月で300社以上のインフルエンサー契約。マーケ専任8〜9名。
- ペイウォールを46箇所のトリガーで123回A/Bテストし、トライアル→有料転換率を31%改善。オンボーディング→課金の転換率は20〜25%。

### 市場の状態
- 機能が同質化し、開発国市場では**飽和**。差別化が難しく、目立つためのマーケ投下がそのまま利益を圧迫している。
- 抜け道として指摘されているのは、(a) 文化・疾患特化のニッチ、(b) エコシステム化、(c) 法人ウェルネス経由のB2B。

### 決済手数料
- App Store / Google Play: 売上の**15〜30%**。
- Stripe（Web決済）: **約3%**（2.9% + $0.30 相当）。
- 30%区分ならWeb決済に寄せるだけで**26.8ポイント**の粗利差。

---

## 2. 戦略判断

### 採らなかった選択肢と理由

**(a) B2C正面戦（アプリストア中心＋広告/インフルエンサー投下）**
Cal AIが勝ったやり方だが、**月数十万ドルの広告費と専任マーケ8〜9名が前提**。この資源がない状態で同じ土俵に立つと、CACが回収不能になる。却下。

**(b) 特定保健指導・法人ウェルネス（B2B）**
ARPUは桁違いに高く、第4期（2024〜2029年度）でICT活用が本格化しているため追い風もある。ただし健保組合・保険者への販売は、実績データ・体制・長い商談サイクルを要求される。**今日から収益が立つ道ではない**ため、初期フェーズでは採らない（将来の拡張余地としては最有力）。

**(c) 買い切り**
実装は最も簡単だが継続収益にならず、原価が毎月かかるAI解析とは相性が最悪。却下。

### 採った戦略

> **Web決済のフリーミアム・サブスクリプション。差別化はAI写真解析。**

3つの判断からなる。

**1. 課金はWebで受ける（ストアを通さない）**
アプリ内課金を使わずWeb決済にすることで、手数料が15〜30%→約3%になる。同じ手取りなら**価格を約25%安くできる**。国内相場が月400〜480円と決まっている市場で、これは価格そのものを武器にできる唯一の構造的優位。
→ 実装: `/pricing` からStripe Checkoutへ直行する導線を作り、アプリからはブラウザで開く。

**2. 差別化は「入力の手間をゼロに近づけること」に一点集中**
このカテゴリの離脱理由は機能不足ではなく**入力の面倒さ**。Cal AIが証明したのは、写真1枚で終わる体験に人は金を払うということ。既存のCaloriappは手入力とUSDA検索しかなく、ここが決定的に欠けていた。
→ 実装: Claudeのvisionで写真から品目分解・分量推定・PFC算出まで行うエンドポイント。

**3. 無料枠は「習慣化させる」ために厚く、「続けると足りなくなる」ように設計**
記録の基本機能（体重・食事・運動・目標・日次サマリー）は無料で無制限。制限をかけたのは以下の3つだけ。

| 制限対象 | 理由 |
|---|---|
| AI写真解析（月5回） | 原価が乗る唯一の機能。かつ最も価値が伝わる機能なので「試させる」必要がある |
| 履歴の閲覧期間（30日） | 使い続けるほど「見えない過去」が増える。継続利用そのものが課金理由に変わる |
| ヘルスケア連携 | 手間がゼロになる機能なので、支払い意思が最も高い |

**記録データ自体は削除しない。** 閲覧範囲を絞るだけにしてある（`historyCutoff`）。解約時にデータを人質に取る設計は、返金要求とレビュー炎上を招き長期的な利益を削るため。

---

## 3. 価格設計

| プラン | 価格 | 月あたり |
|---|---|---|
| Free | 0円 | — |
| Pro（年額） | **3,980円 / 年**（7日間無料） | **332円** |
| Pro（月額） | 680円 / 月 | 680円 |

### 意図
- **年額の月あたり332円は、あすけん(480円)・カロミル(400円)より安い。** Web決済で手数料が浮いた分をそのまま価格優位に変換している。
- **月額680円は相場より高く設定している。** これは売るための価格ではなく、年額を割安に見せるアンカー。年額へ誘導することで、
  - 初月〜3ヶ月の解約（サブスク解約の大半がここに集中する）が構造的に消える
  - 前払いでキャッシュが先に入る
  - LTVが跳ね上がる
- **7日間無料トライアルは年額のみ。** Cal AIの実績（オンボーディング→課金 20〜25%）が示す通り、トライアルは転換率の主要ドライバー。

価格・上限・訴求文はすべて `apps/api/src/lib/plans.ts` の1ファイルに集約し、`/api/me/subscription` 経由でアプリへ配信している。**アプリを再申請せずに価格改定できる。**

---

## 4. ユニットエコノミクス ⚠️ 最重要

### 収益（Pro年額の場合）
```
売上         3,980円 / 年  =  332円 / 月
Stripe手数料  約3.6%       = -12円 / 月
────────────────────────────────────
純収入                        320円 / 月・人
```

### 原価：AI写真解析1回あたり
唯一、利用量に比例して実費がかかる処理。1回の内訳（送信前に長辺1024pxへ縮小済み）:

- 入力: 画像 約1,050トークン + システムプロンプト/スキーマ 約600トークン ≒ **1,650トークン**
- 出力: JSON 約250トークン + 思考トークン ≒ **500〜1,500トークン**（effort: medium）

為替を **1ドル=150円** と仮定した試算:

| モデル | 単価(入力/出力 per MTok) | 1回あたり原価 |
|---|---|---|
| `claude-opus-5`（現在の既定） | $5 / $25 | **約 3.5〜7.0円** |
| `claude-haiku-4-5` | $1 / $5 | **約 0.7〜1.4円** |

### 月間の限界利益（1人あたり）

想定利用: 1日3食記録 = **月90回**

| モデル | 月間原価 | 純収入320円に対して | 粗利率 |
|---|---|---|---|
| `claude-opus-5` | 315〜630円 | **±0 〜 −310円** | **0% 〜 赤字** |
| `claude-haiku-4-5` | 63〜126円 | +194〜257円 | **61〜80%** |

公正利用上限（月150回）に張り付いた最悪ケース:

| モデル | 最悪原価 | 判定 |
|---|---|---|
| `claude-opus-5` | 525〜1,050円 | **確実に赤字** |
| `claude-haiku-4-5` | 105〜210円 | 粗利率 34〜67%、許容範囲 |

### 結論と推奨

> **年額3,980円という価格は、`claude-opus-5` では成立しない。** Opus 5で90回/月を賄うには月1,900円程度（年22,800円）が必要で、これは国内相場の4〜5倍にあたり売れない。

対応は3択で、**これは価格と品質のトレードオフなので判断はあなたに委ねる**:

1. **解析モデルをHaiku 4.5に下げる（推奨）**
   `apps/api/.env` に1行足すだけで切り替わる:
   ```
   FOOD_VISION_MODEL="claude-haiku-4-5"
   ```
   → 粗利率61〜80%を確保できる。食事写真の品目判別と分量概算はHaikuクラスで実用に足る可能性が高いが、**実測して確認すべき**（下記）。

2. **価格を上げる**
   月額1,000円前後まで上げれば、Opus 5でも一定の利用量までは黒字化する。ただし国内相場の2倍以上になり、転換率が大きく落ちる。

3. **上限をさらに絞る**（例: Pro 月30回）
   原価は抑えられるが、「写真で終わる」という価値提案そのものを損なう。最も筋が悪い。

### 判断のためのデータは既に取れるようにしてある
`MealPhotoAnalysis` テーブルに解析ごとの `model` / `inputTokens` / `outputTokens` を保存している。
数十件流せば**実測の平均原価**が出るので、推測ではなく実データで上の表を置き換えて判断できる。

```sql
SELECT model,
       COUNT(*)                     AS analyses,
       AVG("inputTokens")           AS avg_input,
       AVG("outputTokens")          AS avg_output
FROM meal_photo_analyses
GROUP BY model;
```

精度の比較も同じ方法でできる。同じ写真をOpus 5とHaiku 4.5の両方に流し、推定値のズレを見てから決めるのが最も確実。

### CAC（顧客獲得コスト）
広告を打たない前提の初期フェーズでは、CAC≒0の流入経路だけを使う:
- `/` と `/pricing` を検索流入用のLPとして実装済み（メタデータ・OGP設定済み）
- 「写真を撮るだけ」という体験自体がSNSで見せやすく、スクリーンショットが広告になる

LTVは年額3,980円・平均継続2年と仮定して約8,000円（粗利ベースでHaiku採用時 約5,000円）。
**CAC 1,600円以下（LTV/CAC=3）なら広告投下も成立する**が、まずはCAC 0の経路で転換率を実測してから判断すべき。

---

## 5. 実装したもの

### データモデル（`apps/api/prisma/schema.prisma`）
| モデル | 役割 |
|---|---|
| `Subscription` | Stripeの契約状態をDBへ射影（Stripeが常に正） |
| `UsageCounter` | 従量機能の月次使用量。無料枠判定と原価監視を兼ねる |
| `MealPhotoAnalysis` | AI解析の結果とトークン実績。原価の実測値がここに貯まる |
| `User.referralCode` 等 | 広告費0の紹介ループ用の器（導線UIは未実装） |

### エンタイトルメント（`src/lib/entitlements.ts` / `plans.ts`）
- プラン定義・価格・上限を1ファイルに集約
- `getEntitlement()` がStripeのstatusと期末日から実効プランを判定
  - `PAST_DUE` は**3日間の猶予**を持たせる（カード期限切れによる非自発的解約は待てば回収できる）
  - `CANCELED` でも支払い済み期間内はProのまま
- `consumeQuota()` は「先に加算し、超過なら戻す」方式で同時実行でも上限を超えない
- `refundQuota()` で外部API失敗時に枠を返す（失敗で枠を消費させると課金前に信用を失う）

### 課金フロー（Stripe）
| エンドポイント | 役割 |
|---|---|
| `POST /api/billing/checkout` | Checkout Session作成（年額/月額、トライアル、プロモコード対応） |
| `POST /api/billing/portal` | Customer Portal（支払い方法変更・解約をStripeに委譲） |
| `POST /api/billing/webhook` | 署名検証つきWebhook。作成/更新/削除/決済失敗/決済成功を購読 |
| `GET /api/me/subscription` | 契約状態＋残枠＋価格を1リクエストで返す |

Webhookは失敗時に5xxを返してStripeにリトライさせる（upsertなので再実行安全）。

### AI写真解析
- `POST /api/meal-logs/analyze-photo`
- Claude visionで品目分解 → 分量推定 → PFC算出。structured outputsで形を保証
- 確信度と推定の前提（note）を必ず返し、ユーザーがその場で直せる
- `autoCreate` で解析から食事記録の作成まで1リクエスト

### 既存エンドポイントへのゲーティング
| 対象 | 制限 |
|---|---|
| `/api/foods/search` | 従量（無料 月50回） |
| `/api/foods` POST | 自前登録数（無料 10件） |
| `/api/health-logs` POST | Pro専用 |
| `/api/weight-logs` GET・`/api/daily-summary` 範囲取得 | 閲覧期間（無料 30日） |

402 + `code: quota_exceeded / plan_required` を返し、クライアントはこれでペイウォールを出し分ける。

### Webファネル（`apps/api/src/app`）
- `/` … LP（課題提起→機能→料金→FAQ→CTA）。SEO/OGPメタデータ設定済み
- `/pricing` … 料金比較表＋その場で登録/ログイン→Stripeへ直行するフォーム
- `/billing/success`, `/account` … 決済後の着地と契約管理
- ライト/ダーク両対応、スマホ幅対応

### モバイル（`apps/mobile`）
- `app/meal-photo.tsx` … 撮影/選択 → 解析 → 分量修正（栄養値も比例して追従）→ 記録
- 送信前に長辺1024px・JPEG品質0.7へ縮小（**入力トークン＝原価が直接減る**）
- `components/PaywallCard.tsx` … 価格も訴求文もサーバーから取得
- 食事タブに「写真で記録」を主導線として配置
- 設定画面にプラン状態・今月の利用量・アップグレード/解約導線

---

## 6. 人がやる必要がある作業

コード側は完成しているが、以下は外部サービスの設定なので手を動かす必要がある。

### 6.1 Neonへのマイグレーション（HANDOFF.mdから継続の未完了項目）
クラウド実行環境からはDBに到達できないため未実施。ローカルで:
```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate    # Subscription / UsageCounter / MealPhotoAnalysis が作られる
```

### 6.2 Stripeの設定
1. https://dashboard.stripe.com で日本の事業者として登録（本番利用には審査が必要）
2. Product「Caloriapp Pro」を作り、Priceを2つ作成:
   - 年額 3,980円 JPY / recurring / interval=year
   - 月額 680円 JPY / recurring / interval=month
3. 作成したPrice IDを `.env` の `STRIPE_PRICE_ID_YEARLY` / `STRIPE_PRICE_ID_MONTHLY` に設定
4. Webhookエンドポイントを登録: `https://<本番ドメイン>/api/billing/webhook`
   購読イベント: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
5. 署名シークレットを `STRIPE_WEBHOOK_SECRET` に設定
6. ローカル検証: `stripe listen --forward-to localhost:3000/api/billing/webhook`

### 6.3 Anthropic APIキー
https://console.anthropic.com で発行し `ANTHROPIC_API_KEY` に設定。
**4章の判断を先にすること。** Haikuにするなら `FOOD_VISION_MODEL="claude-haiku-4-5"` も設定する。

### 6.4 デプロイ
Vercelに `apps/api` をルートとしてデプロイし、上記の環境変数をすべて登録。`APP_URL` は本番ドメイン。
`pnpm prisma:deploy` でマイグレーション適用。

### 6.5 ⚠️ アプリストア規約の確認（法務リスク）
アプリから外部Web決済へ誘導する形式は、従来Apple/Googleの規約で制限されていた。
日本では**スマホソフトウェア競争促進法**により外部課金・外部リンクの取り扱いが変わっているが、
**実際の審査運用は必ず最新の規約で確認すること。** 具体的には:
- iOS版を配布する場合、`openCheckout()`（ブラウザで `/pricing` を開く）が審査で問題にならないか
- 問題になる場合の代替案: iOSのみアプリ内課金（StoreKit / RevenueCat）を併用し、Web決済はAndroid・Web限定にする

なお `HANDOFF.md` 記載のとおり配布想定は**EAS Buildによる内部配布**（ストア審査なし）なので、
その形態を維持する限りこの制約は発生しない。

### 6.6 セキュリティ（HANDOFF.md 10章から継続）
過去の会話でNeonの接続文字列が平文共有されている。**パスワードのローテーションは未対応なら今すぐ実施すること。**

---

## 7. 次の一手（優先順）

1. **モデルの実測と決定**（4章）— これが決まらないと利益が出るか決まらない。最優先。
2. **転換率の計測** — オンボーディング→トライアル→有料の各段階。Cal AIは123回のA/Bテストで転換率を31%改善した。計測なしの改善はできない。
3. **紹介プログラムの導線実装** — DBの器は用意済み。CAC 0で成長を回す唯一の手段。
4. **週次レポート** — Pro専用機能として約束しているが未実装。解約抑止に直結する。
5. **HealthKit / Google Fit実連携** — Pro最大の訴求点だが、アプリ側が未実装（APIは対応済み）。
6. **法人ウェルネス / 特定保健指導** — B2Cで継続率の実績が貯まってから。ARPUの桁が変わる。

---

## 8. 出典

- [Calorie Counter Websites and Apps Market Size](https://www.businessresearchinsights.com/market-reports/calorie-counter-websites-and-apps-market-124536)
- [Cal AI Revenue 2026: $40M ARR (Bootstrapped) — GetLatka](https://getlatka.com/companies/calai.app)
- [MyFitnessPal has acquired Cal AI — TechCrunch](https://techcrunch.com/2026/03/02/myfitnesspal-has-acquired-cal-ai-the-viral-calorie-app-built-by-teens)
- [How Cal AI turned influencer marketing into a $50M growth engine — FunnelFox](https://blog.funnelfox.com/cal-ai-influencer-marketing/)
- [How Cal AI scaled paywall experimentation — Superwall](https://superwall.com/case-studies/cal-ai)
- [食事管理アプリ比較2026年版（あすけん・カロミル）](https://issin.cc/blogs/article/diet-app-comparison-2026)
- [AIダイエットとは？AI食事管理アプリ比較【2026年版】 — renue](https://renue.co.jp/posts/ai-diet-weight-management-calorie-app-guide-2026)
- [Stripe Fees for Digital Goods: 3% vs the App Stores' 15-30%](https://www.mirava.io/blog/stripe-vs-app-stores-fee-structures-compared)
- [App Store vs. Web Funnel: Where Subscription Apps Should Convert](https://semnexus.com/app-store-vs-web-funnel-where-subscription-apps-convert)
- [Calorie Counter Apps Market（市場飽和と差別化）— openPR](https://www.openpr.com/news/4401007/calorie-counter-apps-market-set-to-surge-through-2033-as)
- [特定健診・特定保健指導について — 厚生労働省](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000161103.html)
