import type { Metadata } from "next";
import { AccountPanel } from "@/components/AccountPanel";

export const metadata: Metadata = {
  title: "アカウント",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <main className="container hero">
      <h1 style={{ fontSize: "clamp(26px, 4vw, 34px)" }}>アカウント</h1>
      <AccountPanel />
    </main>
  );
}
