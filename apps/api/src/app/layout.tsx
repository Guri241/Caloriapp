import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const SITE_NAME = "Caloriapp";
const SITE_DESCRIPTION =
  "写真を撮るだけで、カロリーとPFCが記録される。続かない食事管理を、続く食事管理に変えるダイエットアプリ。";

// 検索とSNSからの流入をそのまま課金導線に載せるため、
// LP・料金ページはアプリ本体と同じドメインで配信する。
export const metadata: Metadata = {
  metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
  title: {
    default: `${SITE_NAME} | 写真を撮るだけの食事記録アプリ`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | 写真を撮るだけの食事記録アプリ`,
    description: SITE_DESCRIPTION,
    locale: "ja_JP",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand">
              Caloriapp
            </Link>
            <nav className="nav">
              <Link href="/#features">できること</Link>
              <Link href="/pricing">料金</Link>
              <Link href="/account">アカウント</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">
            <p style={{ margin: 0 }}>
              © {new Date().getFullYear()} Caloriapp — 記録した食事データはいつでもエクスポートできます。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
