import Stripe from "stripe";

// SDK(v22)が生成する型と一致するAPIバージョンに固定する。
// 省略するとStripeアカウント側の既定バージョンが使われ、型と実レスポンスがずれる。
const STRIPE_API_VERSION = "2026-08-26.dahlia";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }

  cached = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  return cached;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
  }
  return secret;
}

// Checkout完了後の戻り先。Webアプリと決済ページが同一オリジンである前提。
export function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error("APP_URL environment variable is not set");
  }
  return url.replace(/\/$/, "");
}
