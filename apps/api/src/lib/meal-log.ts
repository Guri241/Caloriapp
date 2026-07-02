import { prisma } from "./prisma";
import { ApiError } from "./api-response";
import type { Prisma } from "@prisma/client";

export interface MealLogItemInput {
  foodId?: string;
  customName?: string;
  amountG: number;
  caloriesKcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
}

// Food参照の品目は、Foodの100gあたり値とamountGから実摂取値を計算する。
// 手入力(foodId未指定)の品目は、リクエストで渡された栄養値をそのまま使う。
export async function buildItemsData(
  userId: string,
  items: MealLogItemInput[],
): Promise<Prisma.MealLogItemCreateWithoutMealLogInput[]> {
  const foodIds = items.map((item) => item.foodId).filter((id): id is string => !!id);
  const foods = foodIds.length
    ? await prisma.food.findMany({
        where: { id: { in: foodIds }, OR: [{ userId: null }, { userId }] },
      })
    : [];
  const foodMap = new Map(foods.map((food) => [food.id, food]));

  return items.map((item) => {
    if (item.foodId) {
      const food = foodMap.get(item.foodId);
      if (!food) {
        throw new ApiError(400, `Food not found: ${item.foodId}`);
      }
      const baseG = food.servingSizeG ?? 100;
      const ratio = item.amountG / baseG;
      return {
        food: { connect: { id: food.id } },
        amountG: item.amountG,
        caloriesKcal: food.caloriesKcal * ratio,
        proteinG: food.proteinG * ratio,
        fatG: food.fatG * ratio,
        carbsG: food.carbsG * ratio,
      };
    }

    if (
      item.caloriesKcal === undefined ||
      item.proteinG === undefined ||
      item.fatG === undefined ||
      item.carbsG === undefined
    ) {
      throw new ApiError(
        400,
        "caloriesKcal/proteinG/fatG/carbsG are required for manual entries",
      );
    }

    return {
      customName: item.customName,
      amountG: item.amountG,
      caloriesKcal: item.caloriesKcal,
      proteinG: item.proteinG,
      fatG: item.fatG,
      carbsG: item.carbsG,
    };
  });
}
