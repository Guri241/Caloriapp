"use client";

import { useState } from "react";
import { CheckoutPanel } from "./CheckoutPanel";

interface PriceView {
  interval: "MONTH" | "YEAR";
  amountJpy: number;
  monthlyEquivalentJpy: number;
  trialDays: number;
}

// 年額を初期選択にする。月額は年額の割安感を作るための比較対象として並べる。
export function PricingSelector({ year, month }: { year: PriceView; month: PriceView }) {
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("YEAR");
  const selected = interval === "YEAR" ? year : month;

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <h3 style={{ marginTop: 0 }}>Proをはじめる</h3>

      <div style={{ display: "grid", gap: 10, margin: "16px 0 20px" }}>
        {[year, month].map((price) => {
          const isSelected = price.interval === interval;
          return (
            <label
              key={price.interval}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                background: isSelected ? "var(--accent-soft)" : "transparent",
                borderRadius: 10,
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="interval"
                checked={isSelected}
                onChange={() => setInterval(price.interval)}
              />
              <span style={{ flex: 1 }}>
                <strong>{price.interval === "YEAR" ? "年額プラン" : "月額プラン"}</strong>
                {price.interval === "YEAR" ? <span className="badge">おすすめ</span> : null}
                <br />
                <span className="note">
                  {price.amountJpy.toLocaleString("ja-JP")}円
                  {price.interval === "YEAR"
                    ? ` / 年（月あたり${price.monthlyEquivalentJpy}円）`
                    : " / 月"}
                  {price.trialDays > 0 ? `・${price.trialDays}日間無料` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <CheckoutPanel interval={interval} />

      <p className="note" style={{ marginTop: 14 }}>
        {selected.trialDays > 0
          ? `${selected.trialDays}日間は無料です。期間中に解約すれば請求は発生しません。`
          : "いつでも解約できます。解約後も支払い済みの期間はProのまま使えます。"}
      </p>
    </div>
  );
}
