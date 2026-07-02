import { ApiError } from "./api-response";

const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

// USDA FoodData Centralのnutrient番号（栄養素マスタで固定）
const NUTRIENT_NUMBERS = {
  calories: "208", // Energy (kcal)
  protein: "203", // Protein
  fat: "204", // Total lipid (fat)
  carbs: "205", // Carbohydrate, by difference
};

interface UsdaFoodNutrient {
  nutrientNumber?: string;
  nutrientName?: string;
  value?: number;
  unitName?: string;
}

interface UsdaFoodItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodNutrients: UsdaFoodNutrient[];
}

interface UsdaSearchResponse {
  foods: UsdaFoodItem[];
}

export interface NormalizedUsdaFood {
  externalSource: "usda";
  externalId: string;
  name: string;
  brand: string | null;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  servingSizeG: number;
}

function pickNutrient(nutrients: UsdaFoodNutrient[], number: string): number {
  const match = nutrients.find((n) => n.nutrientNumber === number);
  return match?.value ?? 0;
}

// USDA FoodData Central APIで食品を検索し、Foodマスタの形式に正規化して返す。
// 検索結果は原則100gあたりの栄養値で正規化されている（Branded Foodsも同様）。
export async function searchUsdaFoods(query: string): Promise<NormalizedUsdaFood[]> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "USDA_API_KEY environment variable is not set");
  }

  const url = new URL(USDA_SEARCH_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "25");
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new ApiError(502, `USDA API request failed: ${response.status}`);
  }

  const data = (await response.json()) as UsdaSearchResponse;

  return (data.foods ?? []).map((food) => ({
    externalSource: "usda" as const,
    externalId: String(food.fdcId),
    name: food.description,
    brand: food.brandOwner ?? null,
    caloriesKcal: pickNutrient(food.foodNutrients, NUTRIENT_NUMBERS.calories),
    proteinG: pickNutrient(food.foodNutrients, NUTRIENT_NUMBERS.protein),
    fatG: pickNutrient(food.foodNutrients, NUTRIENT_NUMBERS.fat),
    carbsG: pickNutrient(food.foodNutrients, NUTRIENT_NUMBERS.carbs),
    servingSizeG: 100,
  }));
}
