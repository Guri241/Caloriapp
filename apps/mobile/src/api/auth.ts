import { apiFetch } from "./client";
import type { AuthResponse, User } from "./types";

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function register(email: string, password: string, name?: string) {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { email, password, name },
    auth: false,
  });
}

export function fetchMe() {
  return apiFetch<User>("/api/auth/me");
}
