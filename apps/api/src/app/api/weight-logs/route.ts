import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { weightLogSchema } from "@/lib/validation";
import { handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";

export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Number(searchParams.get("limit") ?? 100);

    const logs = await prisma.weightLog.findMany({
      where: {
        userId,
        recordedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { recordedAt: "desc" },
      take: Math.min(limit, 500),
    });

    return jsonOk(logs);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const body = weightLogSchema.parse(await request.json());

    const log = await prisma.weightLog.create({
      data: {
        userId,
        weightKg: body.weightKg,
        bodyFatPct: body.bodyFatPct,
        recordedAt: new Date(body.recordedAt),
        source: body.source ?? "manual",
      },
    });

    await recalcDailySummary(userId, log.recordedAt);

    return jsonOk(log, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
