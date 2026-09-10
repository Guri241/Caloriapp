import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { searchUsdaFoods } from "@/lib/usda";
import { consumeQuota } from "@/lib/entitlements";

// USDA FoodData Centralを検索し、結果を共通Foodマスタ(userId=null)にupsertしてから返す。
// こうすることで検索結果のfoodIdをそのままMealLogItem.foodIdとして使い回せる。
export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || q.trim().length === 0) {
      throw new ApiError(400, "Query parameter 'q' is required");
    }

    // 外部API呼び出しの前に枠を消費する（上限到達時は402でペイウォールを出す）
    const quota = await consumeQuota(userId, "FOOD_SEARCH");

    const results = await searchUsdaFoods(q.trim());

    const foods = await Promise.all(
      results.map((item) =>
        prisma.food.upsert({
          where: {
            externalSource_externalId: {
              externalSource: item.externalSource,
              externalId: item.externalId,
            },
          },
          create: {
            name: item.name,
            brand: item.brand,
            caloriesKcal: item.caloriesKcal,
            proteinG: item.proteinG,
            fatG: item.fatG,
            carbsG: item.carbsG,
            servingSizeG: item.servingSizeG,
            externalSource: item.externalSource,
            externalId: item.externalId,
          },
          update: {
            name: item.name,
            brand: item.brand,
            caloriesKcal: item.caloriesKcal,
            proteinG: item.proteinG,
            fatG: item.fatG,
            carbsG: item.carbsG,
          },
        }),
      ),
    );

    return jsonOk({ foods, quota });
  } catch (error) {
    return handleApiError(error);
  }
}
