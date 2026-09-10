import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { consumeQuota, refundQuota } from "@/lib/entitlements";
import { recalcDailySummary } from "@/lib/daily-summary";
import { SUPPORTED_MEDIA_TYPES, analyzeFoodPhoto } from "@/lib/food-vision";

export const runtime = "nodejs";
// 画像を受け取るので、静的化や事前レンダリングの対象にしない。
export const dynamic = "force-dynamic";

// Vercelのリクエストボディ上限（4.5MB）に収まる範囲で受け付ける。
// アプリ側では長辺1024px程度にリサイズしてから送る想定。
const MAX_BASE64_LENGTH = 3_000_000;

const analyzeSchema = z.object({
  imageBase64: z.string().min(1).max(MAX_BASE64_LENGTH, "Image is too large"),
  mediaType: z.enum(SUPPORTED_MEDIA_TYPES),
  // 「ラーメンは半分残した」など、写真だけでは分からない補足
  hint: z.string().max(200).optional(),
  // trueなら解析結果をそのまま食事記録として保存する（タップ数を減らすため）
  autoCreate: z.boolean().default(false),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).default("LUNCH"),
  loggedAt: z.string().datetime().optional(),
});

// 食事写真を解析してPFCを推定する。
// 解析結果はMealPhotoAnalysisに保存し、autoCreate時はMealLogまで作る。
export async function POST(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const body = analyzeSchema.parse(await request.json());

    // 外部APIを叩く前に枠を押さえる（同時実行で上限を超えないようにするため）
    const quota = await consumeQuota(userId, "AI_PHOTO_ANALYSIS");

    let result;
    try {
      result = await analyzeFoodPhoto(body.imageBase64, body.mediaType, body.hint);
    } catch (error) {
      // 解析に失敗した分は枠を返す
      await refundQuota(userId, "AI_PHOTO_ANALYSIS");
      throw error;
    }

    const { analysis } = result;

    const record = await prisma.mealPhotoAnalysis.create({
      data: {
        userId,
        items: analysis.items as unknown as Prisma.InputJsonValue,
        confidence: analysis.confidence,
        note: analysis.note,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    if (analysis.items.length === 0) {
      return jsonOk(
        {
          analysisId: record.id,
          items: [],
          confidence: analysis.confidence,
          note: analysis.note,
          mealLog: null,
          quota,
        },
        200,
      );
    }

    let mealLog = null;
    if (body.autoCreate) {
      const loggedAt = body.loggedAt ? new Date(body.loggedAt) : new Date();
      mealLog = await prisma.mealLog.create({
        data: {
          userId,
          mealType: body.mealType,
          loggedAt,
          memo: analysis.note,
          items: {
            create: analysis.items.map((item) => ({
              customName: item.name,
              amountG: item.amountG,
              caloriesKcal: item.caloriesKcal,
              proteinG: item.proteinG,
              fatG: item.fatG,
              carbsG: item.carbsG,
            })),
          },
        },
        include: { items: { include: { food: true } } },
      });

      await prisma.mealPhotoAnalysis.update({
        where: { id: record.id },
        data: { mealLogId: mealLog.id },
      });

      await recalcDailySummary(userId, loggedAt);
    }

    return jsonOk(
      {
        analysisId: record.id,
        items: analysis.items,
        confidence: analysis.confidence,
        note: analysis.note,
        mealLog,
        quota,
      },
      mealLog ? 201 : 200,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
