import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  // クライアントが分岐に使う機械可読コード（例: 'quota_exceeded'）。
  // メッセージ文言を変えても分岐が壊れないようにするため。
  code?: string;
  // コードに紐づく追加情報（上限値・現在値・アップグレード先など）。
  details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    options?: { code?: string; details?: Record<string, unknown> },
  ) {
    super(message);
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...(error.details ?? {}) },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.flatten() },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
