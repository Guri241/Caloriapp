import { prisma } from "./prisma";

// 集計対象日を00:00:00(UTC)に正規化する
export function normalizeDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function dayRange(date: Date): { start: Date; end: Date } {
  const start = normalizeDate(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

// 指定ユーザー・指定日のDailySummaryを、MealLog/ExerciseLog/HealthLog/WeightLogから再計算して保存する。
// 記録の作成・更新・削除のたびに呼び出す想定。
export async function recalcDailySummary(userId: string, targetDate: Date) {
  const date = normalizeDate(targetDate);
  const { start, end } = dayRange(date);

  const [mealItems, exerciseLogs, healthCalories, latestWeight] = await Promise.all([
    prisma.mealLogItem.findMany({
      where: { mealLog: { userId, loggedAt: { gte: start, lt: end } } },
      select: { caloriesKcal: true, proteinG: true, fatG: true, carbsG: true },
    }),
    prisma.exerciseLog.aggregate({
      where: { userId, performedAt: { gte: start, lt: end } },
      _sum: { caloriesBurned: true },
    }),
    prisma.healthLog.aggregate({
      where: {
        userId,
        dataType: "ACTIVE_CALORIES",
        recordedAt: { gte: start, lt: end },
      },
      _sum: { value: true },
    }),
    prisma.weightLog.findFirst({
      where: { userId, recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: "desc" },
      select: { weightKg: true },
    }),
  ]);

  const totals = mealItems.reduce(
    (acc, item) => {
      acc.calories += item.caloriesKcal;
      acc.protein += item.proteinG;
      acc.fat += item.fatG;
      acc.carbs += item.carbsG;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );

  const totalBurnedKcal =
    (exerciseLogs._sum.caloriesBurned ?? 0) + (healthCalories._sum.value ?? 0);

  return prisma.dailySummary.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      totalIntakeKcal: totals.calories,
      totalBurnedKcal,
      netCaloriesKcal: totals.calories - totalBurnedKcal,
      totalProteinG: totals.protein,
      totalFatG: totals.fat,
      totalCarbsG: totals.carbs,
      latestWeightKg: latestWeight?.weightKg,
    },
    update: {
      totalIntakeKcal: totals.calories,
      totalBurnedKcal,
      netCaloriesKcal: totals.calories - totalBurnedKcal,
      totalProteinG: totals.protein,
      totalFatG: totals.fat,
      totalCarbsG: totals.carbs,
      latestWeightKg: latestWeight?.weightKg,
    },
  });
}
