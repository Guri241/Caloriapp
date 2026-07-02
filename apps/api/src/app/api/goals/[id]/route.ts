import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { goalSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";

async function getOwnedGoal(userId: string, id: string) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) {
    throw new ApiError(404, "Goal not found");
  }
  return goal;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    const goal = await getOwnedGoal(userId, id);
    return jsonOk(goal);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    await getOwnedGoal(userId, id);
    const body = goalSchema.partial().parse(await request.json());

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        targetWeightKg: body.targetWeightKg,
        startWeightKg: body.startWeightKg,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      },
    });

    return jsonOk(goal);
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
    await getOwnedGoal(userId, id);
    await prisma.goal.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
