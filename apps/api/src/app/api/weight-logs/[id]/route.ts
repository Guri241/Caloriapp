import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { weightLogSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";

async function getOwnedLog(userId: string, id: string) {
  const log = await prisma.weightLog.findUnique({ where: { id } });
  if (!log || log.userId !== userId) {
    throw new ApiError(404, "Weight log not found");
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
    const body = weightLogSchema.partial().parse(await request.json());

    const log = await prisma.weightLog.update({
      where: { id },
      data: {
        weightKg: body.weightKg,
        bodyFatPct: body.bodyFatPct,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
        source: body.source,
      },
    });

    await recalcDailySummary(userId, log.recordedAt);

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
    await prisma.weightLog.delete({ where: { id } });
    await recalcDailySummary(userId, log.recordedAt);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
