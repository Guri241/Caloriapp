import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { mealLogSchema } from "@/lib/validation";
import { handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";
import { buildItemsData } from "@/lib/meal-log";

export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Number(searchParams.get("limit") ?? 100);

    const logs = await prisma.mealLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: { items: { include: { food: true } } },
      orderBy: { loggedAt: "desc" },
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
    const body = mealLogSchema.parse(await request.json());
    const itemsData = await buildItemsData(userId, body.items);

    const log = await prisma.mealLog.create({
      data: {
        userId,
        mealType: body.mealType,
        loggedAt: new Date(body.loggedAt),
        memo: body.memo,
        items: { create: itemsData },
      },
      include: { items: { include: { food: true } } },
    });

    await recalcDailySummary(userId, log.loggedAt);

    return jsonOk(log, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
