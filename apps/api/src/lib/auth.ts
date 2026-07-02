import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ApiError } from "./api-response";

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = "30d";

export interface JwtPayload {
  userId: string;
  email: string;
}

function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return JWT_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}

// Authorization: Bearer <token> ヘッダーから認証済みユーザーのpayloadを取得する。
// 認証必須のRoute Handlerの先頭で呼び出す。
export function requireAuth(request: Request): JwtPayload {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authorization header missing");
  }
  const token = authHeader.slice("Bearer ".length);
  return verifyToken(token);
}
