import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, name: body.name },
    });

    const token = signToken({ userId: user.id, email: user.email });

    return jsonOk(
      {
        token,
        user: { id: user.id, email: user.email, name: user.name },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
