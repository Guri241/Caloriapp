import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { foodSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    const food = await prisma.food.findUnique({ where: { id } });
    if (!food || (food.userId !== null && food.userId !== userId)) {
      throw new ApiError(404, "Food not found");
    }
    return jsonOk(food);
  } catch (error) {
    return handleApiError(error);
  }
}

// 自前登録した食品のみ編集・削除可能（共通マスタ・他ユーザーの食品は不可）
async function getOwnFood(userId: string, id: string) {
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || food.userId !== userId) {
    throw new ApiError(404, "Food not found or not editable");
  }
  return food;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    await getOwnFood(userId, id);
    const body = foodSchema.partial().parse(await request.json());

    const food = await prisma.food.update({ where: { id }, data: body });
    return jsonOk(food);
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
    await getOwnFood(userId, id);
    await prisma.food.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
