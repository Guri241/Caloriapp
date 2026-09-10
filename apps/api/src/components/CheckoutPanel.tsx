"use client";

import { useState } from "react";
import { apiFetch, getToken, setToken } from "./session";

type Interval = "MONTH" | "YEAR";
type Mode = "register" | "login";

interface AuthResponse {
  token: string;
}

interface CheckoutResponse {
  url: string;
}

// 決済までの摩擦を最小にするため、登録・ログイン・チェックアウトを1画面で完結させる。
// 既にログイン済みなら、そのままStripeへ飛ばす。
export function CheckoutPanel({ interval }: { interval: Interval }) {
  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startCheckout() {
    const { url } = await apiFetch<CheckoutResponse>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval }),
    });
    window.location.href = url;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!getToken()) {
        const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
        const { token } = await apiFetch<AuthResponse>(path, {
          method: "POST",
          auth: false,
          body: JSON.stringify({ email, password }),
        });
        setToken(token);
      }
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error ? <p className="error">{error}</p> : null}

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
        <span>パスワード（8文字以上）</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
        {busy ? "処理中..." : "決済ページへ進む"}
      </button>

      <p className="note" style={{ marginTop: 12 }}>
        {mode === "register" ? "すでにアカウントをお持ちですか？" : "アカウントをお持ちでないですか？"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "register" ? "login" : "register")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--accent)",
            cursor: "pointer",
            font: "inherit",
            textDecoration: "underline",
          }}
        >
          {mode === "register" ? "ログイン" : "新規登録"}
        </button>
      </p>
    </form>
  );
}
