import { prisma } from "@/lib/prisma";
import { signToken, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signToken({ userId: user.id, email: user.email });

    return jsonOk({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
