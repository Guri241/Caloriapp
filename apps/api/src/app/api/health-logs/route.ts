import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { healthLogSchema } from "@/lib/validation";
import { handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";
import { requireProFeature } from "@/lib/entitlements";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const logs = await prisma.healthLog.findMany({
      where: {
        userId,
        recordedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { recordedAt: "desc" },
      take: 500,
    });

    return jsonOk(logs);
  } catch (error) {
    return handleApiError(error);
  }
}

// HealthKit/Google Fitからのバッチ同期用エンドポイント。
// アプリ起動時・Pull-to-Refresh時にまとめて送信される想定。
// (userId, source, dataType, recordedAt) の一意制約により重複同期はupsertで無視される。
const syncSchema = z.object({ logs: z.array(healthLogSchema).min(1) });

export async function POST(request: Request) {
  try {
    const { userId } = requireAuth(request);
    // ヘルスケア連携はPro専用（記録の手間がゼロになる=最も課金理由になる機能）
    await requireProFeature(userId, "healthSync");
    const { logs } = syncSchema.parse(await request.json());

    const results = await Promise.all(
      logs.map((log) =>
        prisma.healthLog.upsert({
          where: {
            userId_source_dataType_recordedAt: {
              userId,
              source: log.source,
              dataType: log.dataType,
              recordedAt: new Date(log.recordedAt),
            },
          },
          create: {
            userId,
            source: log.source,
            dataType: log.dataType,
            value: log.value,
            recordedAt: new Date(log.recordedAt),
          },
          update: { value: log.value },
        }),
      ),
    );

    const affectedDates = new Set(
      results.map((log) => log.recordedAt.toISOString().slice(0, 10)),
    );
    await Promise.all(
      Array.from(affectedDates).map((d) => recalcDailySummary(userId, new Date(d))),
    );

    return jsonOk({ synced: results.length }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
