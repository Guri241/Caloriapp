import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { goalSchema } from "@/lib/validation";
import { handleApiError, jsonOk } from "@/lib/api-response";

function withProgress(goal: {
  startWeightKg: number;
  targetWeightKg: number;
  latestWeightKg?: number | null;
}) {
  const totalChange = goal.startWeightKg - goal.targetWeightKg;
  const currentChange =
    goal.latestWeightKg != null ? goal.startWeightKg - goal.latestWeightKg : null;
  const progressPct =
    currentChange != null && totalChange !== 0
      ? Math.round((currentChange / totalChange) * 1000) / 10
      : null;
  return { ...goal, progressPct };
}

export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const goals = await prisma.goal.findMany({
      where: { userId, isActive: activeOnly ? true : undefined },
      orderBy: { createdAt: "desc" },
    });

    const latestWeight = await prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      select: { weightKg: true },
    });

    return jsonOk(
      goals.map((goal) =>
        withProgress({ ...goal, latestWeightKg: latestWeight?.weightKg }),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// 新しい目標を作成する際は、既存のアクティブな目標を自動的に非アクティブ化する
// （進捗率計算のため過去の目標履歴は削除せず残す）
export async function POST(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const body = goalSchema.parse(await request.json());

    const goal = await prisma.$transaction(async (tx) => {
      await tx.goal.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
      return tx.goal.create({
        data: {
          userId,
          targetWeightKg: body.targetWeightKg,
          startWeightKg: body.startWeightKg,
          startDate: new Date(body.startDate),
          targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
          isActive: true,
        },
      });
    });

    return jsonOk(goal, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
