import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "お支払い完了",
  robots: { index: false },
};

// Stripeからの戻り先。契約状態の確定はWebhookで行うため、ここでは案内だけを出す。
export default function BillingSuccessPage() {
  return (
    <main className="container hero">
      <span className="eyebrow">完了</span>
      <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>Proが有効になりました</h1>
      <p className="lead">
        アプリを開き直すと、AI写真解析の上限とすべての履歴が解放されています。
        反映まで数秒かかることがあります。
      </p>
      <div className="cta-row">
        <Link href="/account" className="btn btn-primary">
          アカウントを確認する
        </Link>
      </div>
    </main>
  );
}
