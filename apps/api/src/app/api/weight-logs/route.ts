import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { weightLogSchema } from "@/lib/validation";
import { handleApiError, jsonOk } from "@/lib/api-response";
import { recalcDailySummary } from "@/lib/daily-summary";
import { getEntitlement, historyCutoff } from "@/lib/entitlements";

export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Number(searchParams.get("limit") ?? 100);

    // 記録自体は消さずに、閲覧できる期間だけプランで絞る。
    // 使い続けるほど「見えない過去」が増え、それが継続課金の理由になる。
    const entitlement = await getEntitlement(userId);
    const cutoff = historyCutoff(entitlement);
    const requestedFrom = from ? new Date(from) : null;
    const effectiveFrom =
      cutoff && (!requestedFrom || requestedFrom < cutoff) ? cutoff : requestedFrom;

    const logs = await prisma.weightLog.findMany({
      where: {
        userId,
        recordedAt: {
          gte: effectiveFrom ?? undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { recordedAt: "desc" },
      take: Math.min(limit, 500),
    });

    return jsonOk({
      logs,
      historyLimitedTo: cutoff ? entitlement.limits.historyDays : null,
    });
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
