import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "caloriapp_auth_token";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiClientError extends Error {
  status: number;
  // サーバーが返す機械可読コード。'plan_required' / 'quota_exceeded' で
  // ペイウォールを出し分けるために使う。
  code?: string;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // 402 + コードが返ってきたら課金導線を出すべきエラー
  get isPaywall(): boolean {
    return this.status === 402;
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiClientError(
      response.status,
      errorBody.error ?? "Request failed",
      errorBody.code,
      errorBody,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
