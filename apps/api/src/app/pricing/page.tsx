import type { Metadata } from "next";
import { PricingSelector } from "@/components/PricingSelector";
import { FREE_PLAN, PRICES, PRO_FEATURE_HIGHLIGHTS, PRO_PLAN } from "@/lib/plans";

export const metadata: Metadata = {
  title: "料金プラン",
  description:
    "Caloriappの料金。無料プランはカード登録不要。Proは年額3,980円（月あたり332円）でAI写真解析が月150回使えます。",
};

function formatLimit(value: number | null, unit: string): string {
  return value === null ? "無制限" : `${value}${unit}`;
}

export default function PricingPage() {
  const free = FREE_PLAN.limits;
  const pro = PRO_PLAN.limits;

  return (
    <main>
      <div className="container hero" style={{ paddingBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(28px, 4.5vw, 40px)" }}>料金プラン</h1>
        <p className="lead">
          Web決済のためアプリストア手数料がかからず、その分を価格に反映しています。まず無料で試してください。
        </p>
      </div>

      <section className="container" style={{ paddingTop: 0 }}>
        <div className="plans">
          <div className="plan">
            <h3>Free</h3>
            <p className="price">
              0<small> 円</small>
            </p>
            <p className="note">カード登録なし・期限なし</p>
            <ul>
              <li>体重・食事・運動の記録</li>
              <li>目標設定と日次サマリー</li>
              <li>AI写真解析 月{free.aiPhotoAnalysesPerMonth}回</li>
              <li>食品検索 月{free.foodSearchesPerMonth}回</li>
              <li className="muted">履歴は直近{free.historyDays}日まで</li>
              <li className="muted">週次・月次レポートなし</li>
              <li className="muted">ヘルスケア連携なし</li>
            </ul>
          </div>

          <div className="plan featured">
            <h3>
              Pro<span className="badge">人気</span>
            </h3>
            <p className="price">
              {PRICES.YEAR.monthlyEquivalentJpy}
              <small> 円 / 月</small>
            </p>
            <p className="note">
              年額 {PRICES.YEAR.amountJpy.toLocaleString("ja-JP")}円・
              {PRICES.YEAR.trialDays}日間無料（月額なら{PRICES.MONTH.amountJpy}円）
            </p>
            <ul>
              {PRO_FEATURE_HIGHLIGHTS.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <PricingSelector year={PRICES.YEAR} month={PRICES.MONTH} />
        </div>
      </section>

      <section className="container">
        <h2>プランの違い</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>機能</th>
                <th>Free</th>
                <th>Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>AI写真解析</td>
                <td>{formatLimit(free.aiPhotoAnalysesPerMonth, "回 / 月")}</td>
                <td>{formatLimit(pro.aiPhotoAnalysesPerMonth, "回 / 月")}</td>
              </tr>
              <tr>
                <td>食品データベース検索</td>
                <td>{formatLimit(free.foodSearchesPerMonth, "回 / 月")}</td>
                <td>{formatLimit(pro.foodSearchesPerMonth, "回 / 月")}</td>
              </tr>
              <tr>
                <td>自前の食品登録</td>
                <td>{formatLimit(free.customFoods, "件")}</td>
                <td>{formatLimit(pro.customFoods, "件")}</td>
              </tr>
              <tr>
                <td>履歴の閲覧期間</td>
                <td>{formatLimit(free.historyDays, "日")}</td>
                <td>無期限</td>
              </tr>
              <tr>
                <td>週次・月次レポート</td>
                <td>—</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>HealthKit / Google Fit連携</td>
                <td>—</td>
                <td>✓</td>
              </tr>
              <tr>
                <td>CSVエクスポート</td>
                <td>—</td>
                <td>✓</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          記録したデータは無料プランに戻っても削除されません。閲覧できる期間だけが変わります。
        </p>
      </section>
    </main>
  );
}
