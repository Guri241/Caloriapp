import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { exerciseLogSchema } from "@/lib/validation";
import { handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";

export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Number(searchParams.get("limit") ?? 100);

    const logs = await prisma.exerciseLog.findMany({
      where: {
        userId,
        performedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { performedAt: "desc" },
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
    const body = exerciseLogSchema.parse(await request.json());

    const log = await prisma.exerciseLog.create({
      data: {
        userId,
        exerciseName: body.exerciseName,
        durationMinutes: body.durationMinutes,
        caloriesBurned: body.caloriesBurned,
        performedAt: new Date(body.performedAt),
        source: body.source ?? "manual",
      },
    });

    await recalcDailySummary(userId, log.performedAt);

    return jsonOk(log, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
