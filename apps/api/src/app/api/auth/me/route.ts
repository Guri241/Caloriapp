import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return jsonOk(safeUser);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const body = updateProfileSchema.parse(await request.json());

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: body.name,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        gender: body.gender,
        heightCm: body.heightCm,
        activityLevel: body.activityLevel,
      },
    });

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return jsonOk(safeUser);
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error);
    return handleApiError(error);
  }
}
