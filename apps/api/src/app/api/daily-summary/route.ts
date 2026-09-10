import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-response";
import { normalizeDate, recalcDailySummary } from "@/lib/daily-summary";
import { getEntitlement, historyCutoff } from "@/lib/entitlements";

// ?date=YYYY-MM-DD で単日、?from=&to= で範囲取得。
// 指定日のDailySummaryが未生成の場合はその場で再計算して返す。
export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (date) {
      const summary = await recalcDailySummary(userId, new Date(date));
      return jsonOk(summary);
    }

    const entitlement = await getEntitlement(userId);
    const cutoff = historyCutoff(entitlement);
    const requestedFrom = from ? normalizeDate(new Date(from)) : null;
    const effectiveFrom =
      cutoff && (!requestedFrom || requestedFrom < cutoff) ? normalizeDate(cutoff) : requestedFrom;

    const summaries = await prisma.dailySummary.findMany({
      where: {
        userId,
        date: {
          gte: effectiveFrom ?? undefined,
          lte: to ? normalizeDate(new Date(to)) : undefined,
        },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    return jsonOk(summaries);
  } catch (error) {
    return handleApiError(error);
  }
}
