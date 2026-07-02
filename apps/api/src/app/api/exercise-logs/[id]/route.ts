import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { exerciseLogSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";

async function getOwnedLog(userId: string, id: string) {
  const log = await prisma.exerciseLog.findUnique({ where: { id } });
  if (!log || log.userId !== userId) {
    throw new ApiError(404, "Exercise log not found");
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
    const log = await getOwnedLog(userId, id);
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
    const body = exerciseLogSchema.partial().parse(await request.json());

    const log = await prisma.exerciseLog.update({
      where: { id },
      data: {
        exerciseName: body.exerciseName,
        durationMinutes: body.durationMinutes,
        caloriesBurned: body.caloriesBurned,
        performedAt: body.performedAt ? new Date(body.performedAt) : undefined,
        source: body.source,
      },
    });

    await recalcDailySummary(userId, log.performedAt);

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
    await prisma.exerciseLog.delete({ where: { id } });
    await recalcDailySummary(userId, log.performedAt);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
