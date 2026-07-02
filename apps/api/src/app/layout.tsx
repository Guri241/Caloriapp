export const metadata = {
  title: "Caloriapp API",
  description: "Caloriapp backend API (Next.js API Routes)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
