import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { foodSchema } from "@/lib/validation";
import { handleApiError, jsonOk } from "@/lib/api-response";

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
