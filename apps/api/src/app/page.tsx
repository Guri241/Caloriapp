import Link from "next/link";
import { FREE_PLAN, PRICES } from "@/lib/plans";

// 検索・SNSから来た人が、そのまま料金ページ→決済まで進める導線。
// アプリストアを経由しないので、決済手数料は約3.6%で済む（ストア経由は15-30%）。
export default function HomePage() {
  const year = PRICES.YEAR;

  return (
    <main>
      <div className="container hero">
        <span className="eyebrow">AI食事解析</span>
        <h1>
          写真を撮るだけ。
          <br />
          食事記録は、それで終わり。
        </h1>
        <p className="lead">
          食事管理が続かない理由は、意志ではなく入力の手間です。Caloriappは撮った写真から料理を判別し、
          分量とカロリー・PFCまで推定します。あとは確認して保存するだけ。
        </p>
        <div className="cta-row">
          <Link href="/pricing" className="btn btn-primary">
            {year.trialDays}日間無料ではじめる
          </Link>
          <Link href="/#features" className="btn btn-secondary">
            できることを見る
          </Link>
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          無料プランはカード登録なしで使えます。AI解析は月{FREE_PLAN.limits.aiPhotoAnalysesPerMonth}
          回まで無料。
        </p>
      </div>

      <section className="container" id="features">
        <h2>入力を減らすことに、全部を使いました</h2>
        <p>
          記録アプリが続かないのは、1食あたり数分かかるからです。その数分をゼロに近づけることだけを考えて作っています。
        </p>
        <div className="grid">
          <div className="card">
            <h3>写真から品目ごとに分解</h3>
            <p>
              定食なら「白米」「味噌汁」「焼き鮭」と分けて推定します。食器や箸を手がかりに分量をグラムで見積もり、そのまま記録できます。
            </p>
          </div>
          <div className="card">
            <h3>推定の根拠と確信度を表示</h3>
            <p>
              AIが曖昧なところは黙って断定せず、「ご飯の量は茶碗基準で推定」のように前提を書きます。違えばその場で直せます。
            </p>
          </div>
          <div className="card">
            <h3>体重・運動と同じ画面に</h3>
            <p>
              摂取と消費の収支、PFCバランス、体重の推移が1つのダッシュボードに並びます。何を変えれば減るのかが見えます。
            </p>
          </div>
          <div className="card">
            <h3>ヘルスケア連携</h3>
            <p>
              HealthKit / Google Fitの歩数と活動消費を取り込み、消費カロリー側も自動で埋まります。手で入れるのは体重だけ。
            </p>
          </div>
          <div className="card">
            <h3>週次・月次レポート</h3>
            <p>
              1週間の平均摂取、PFC比率、体重の傾きを自動でまとめます。日々の増減ではなく傾向で判断できます。
            </p>
          </div>
          <div className="card">
            <h3>データは持ち出せます</h3>
            <p>
              記録はCSVでいつでもエクスポートできます。解約してもデータが人質にならないことを設計方針にしています。
            </p>
          </div>
        </div>
      </section>

      <section className="container">
        <h2>料金</h2>
        <p>年額プランなら月あたり{year.monthlyEquivalentJpy}円。まず無料で試して、続けられそうなら切り替えてください。</p>
        <div className="cta-row">
          <Link href="/pricing" className="btn btn-primary">
            料金プランを見る
          </Link>
        </div>
      </section>

      <section className="container faq">
        <h2>よくある質問</h2>
        <details>
          <summary>無料プランだけで使い続けられますか？</summary>
          <p>
            使えます。体重・食事・運動の記録、目標設定、日次サマリーは無料プランでも制限していません。
            AI写真解析（月{FREE_PLAN.limits.aiPhotoAnalysesPerMonth}回）と履歴の閲覧期間（
            {FREE_PLAN.limits.historyDays}日）に上限があります。
          </p>
        </details>
        <details>
          <summary>AIの推定はどのくらい正確ですか？</summary>
          <p>
            料理が明確に写っていれば実用的な精度が出ますが、分量の推定には必ず誤差があります。
            そのため確信度と推定の前提を毎回表示し、その場で数値を修正できるようにしています。
            体組成を管理する目的では、絶対値より継続的な傾向のほうが重要だと考えています。
          </p>
        </details>
        <details>
          <summary>解約はすぐできますか？</summary>
          <p>
            アカウント画面からいつでも解約できます。解約後も支払い済みの期間が終わるまではPro機能を使えます。
            記録したデータは無料プランに戻っても消えません。
          </p>
        </details>
        <details>
          <summary>アプリ内課金ではないのはなぜですか？</summary>
          <p>
            Web決済にすることで、アプリストアに支払う手数料（15〜30%）が不要になります。
            その分を価格に反映しているため、同等の機能を持つアプリより安く提供できています。
          </p>
        </details>
      </section>

      <section className="container">
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h2 style={{ marginBottom: 8 }}>今日の一食から始められます</h2>
          <p style={{ margin: "0 auto 22px" }}>
            登録は30秒。カード情報なしで、今すぐAI解析を{FREE_PLAN.limits.aiPhotoAnalysesPerMonth}回試せます。
          </p>
          <Link href="/pricing" className="btn btn-primary">
            無料ではじめる
          </Link>
        </div>
      </section>
    </main>
  );
}
