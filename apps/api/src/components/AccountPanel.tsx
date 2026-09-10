"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, clearToken, getToken, setToken } from "./session";

interface QuotaView {
  used: number;
  limit: number | null;
  remaining: number | null;
}

interface SubscriptionView {
  tier: "FREE" | "PRO";
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  usage: { aiPhotoAnalysis: QuotaView; foodSearch: QuotaView };
}

function formatQuota(quota: QuotaView): string {
  if (quota.limit === null) return `${quota.used}回（無制限）`;
  return `${quota.used} / ${quota.limit}回`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ja-JP");
}

export function AccountPanel() {
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    if (!getToken()) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      setSubscription(await apiFetch<SubscriptionView>("/api/me/subscription"));
      setError(null);
    } catch (err) {
      // トークンが失効している場合はログインし直してもらう
      clearToken();
      setSubscription(null);
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const { token } = await apiFetch<{ token: string }>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      setToken(token);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    }
  }

  async function openPortal() {
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "請求ページを開けませんでした");
    }
  }

  if (loading) {
    return <p className="note">読み込み中...</p>;
  }

  if (!subscription) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>ログイン</h3>
        {error ? <p className="error">{error}</p> : null}
        <form onSubmit={handleLogin}>
          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>パスワード</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
            ログイン
          </button>
        </form>
        <p className="note" style={{ marginTop: 12 }}>
          アカウントがない場合は<Link href="/pricing">こちら</Link>から作成できます。
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 560 }}>
      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          現在のプラン：{subscription.tier === "PRO" ? "Pro" : "Free"}
        </h3>
        {subscription.isPro ? (
          <p className="note">
            {subscription.status === "TRIALING"
              ? `無料トライアル中（${formatDate(subscription.trialEndsAt)}まで）`
              : subscription.cancelAtPeriodEnd
                ? `${formatDate(subscription.currentPeriodEnd)}に解約予定です。それまではProのまま使えます。`
                : `次回更新日：${formatDate(subscription.currentPeriodEnd)}`}
          </p>
        ) : (
          <p className="note">
            AI写真解析の回数と履歴の閲覧期間に上限があります。
            <Link href="/pricing"> Proにアップグレード</Link>すると解除されます。
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>今月の利用状況</h3>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <td>AI写真解析</td>
                <td>{formatQuota(subscription.usage.aiPhotoAnalysis)}</td>
              </tr>
              <tr>
                <td>食品検索</td>
                <td>{formatQuota(subscription.usage.foodSearch)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          利用回数は毎月1日（UTC）にリセットされます。
        </p>
      </div>

      <div className="cta-row">
        {subscription.isPro ? (
          <button type="button" className="btn btn-secondary" onClick={openPortal}>
            支払い方法・解約の管理
          </button>
        ) : (
          <Link href="/pricing" className="btn btn-primary">
            Proにアップグレード
          </Link>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            clearToken();
            setSubscription(null);
          }}
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
