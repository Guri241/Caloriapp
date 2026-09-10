import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { foodSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { PAYWALL_CODES, getEntitlement } from "@/lib/entitlements";

// ローカルのFoodマスタ（共通マスタ + 自分の自前登録分）を名前検索する
export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const limit = Number(searchParams.get("limit") ?? 30);

    const foods = await prisma.food.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
        name: q ? { contains: q, mode: "insensitive" } : undefined,
      },
      orderBy: { name: "asc" },
      take: Math.min(limit, 100),
    });

    return jsonOk(foods);
  } catch (error) {
    return handleApiError(error);
  }
}

// ユーザーの自前食品登録
export async function POST(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const body = foodSchema.parse(await request.json());

    // 自前登録は無料プランに上限を置く。よく食べるものを登録し切れない状態が
    // そのままアップグレード理由になる。
    const { limits, tier } = await getEntitlement(userId);
    if (limits.customFoods !== null) {
      const registered = await prisma.food.count({ where: { userId } });
      if (registered >= limits.customFoods) {
        throw new ApiError(402, "Custom food limit reached for this plan", {
          code: PAYWALL_CODES.QUOTA_EXCEEDED,
          details: { feature: "customFoods", limit: limits.customFoods, used: registered, tier },
        });
      }
    }

    const food = await prisma.food.create({
      data: {
        userId,
        name: body.name,
        brand: body.brand,
        caloriesKcal: body.caloriesKcal,
        proteinG: body.proteinG,
        fatG: body.fatG,
        carbsG: body.carbsG,
        servingSizeG: body.servingSizeG ?? 100,
      },
    });

    return jsonOk(food, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
