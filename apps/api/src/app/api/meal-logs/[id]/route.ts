import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { mealLogSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";
import { buildItemsData } from "@/lib/meal-log";

async function getOwnedLog(userId: string, id: string) {
  const log = await prisma.mealLog.findUnique({ where: { id } });
  if (!log || log.userId !== userId) {
    throw new ApiError(404, "Meal log not found");
  }
  return log;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    await getOwnedLog(userId, id);
    const log = await prisma.mealLog.findUnique({
      where: { id },
      include: { items: { include: { food: true } } },
    });
    return jsonOk(log);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    await getOwnedLog(userId, id);
    const body = mealLogSchema.partial().parse(await request.json());

    const itemsData = body.items ? await buildItemsData(userId, body.items) : undefined;

    const log = await prisma.$transaction(async (tx) => {
      if (itemsData) {
        await tx.mealLogItem.deleteMany({ where: { mealLogId: id } });
      }
      return tx.mealLog.update({
        where: { id },
        data: {
          mealType: body.mealType,
          loggedAt: body.loggedAt ? new Date(body.loggedAt) : undefined,
          memo: body.memo,
          items: itemsData ? { create: itemsData } : undefined,
        },
        include: { items: { include: { food: true } } },
      });
    });

    await recalcDailySummary(userId, log.loggedAt);

    return jsonOk(log);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    const log = await getOwnedLog(userId, id);
    await prisma.mealLog.delete({ where: { id } });
    await recalcDailySummary(userId, log.loggedAt);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
