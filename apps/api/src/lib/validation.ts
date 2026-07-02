import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  gender: z.string().optional(),
  heightCm: z.number().positive().optional(),
  activityLevel: z
    .enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"])
    .optional(),
});

export const weightLogSchema = z.object({
  weightKg: z.number().positive(),
  bodyFatPct: z.number().min(0).max(100).optional(),
  recordedAt: z.string().datetime(),
  source: z.string().optional(),
});

export const exerciseLogSchema = z.object({
  exerciseName: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
  caloriesBurned: z.number().nonnegative(),
  performedAt: z.string().datetime(),
  source: z.string().optional(),
});

export const goalSchema = z.object({
  targetWeightKg: z.number().positive(),
  startWeightKg: z.number().positive(),
  startDate: z.string().datetime(),
  targetDate: z.string().datetime().optional(),
});

export const foodSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  caloriesKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  servingSizeG: z.number().positive().optional(),
});

export const mealLogItemSchema = z
  .object({
    foodId: z.string().optional(),
    customName: z.string().optional(),
    amountG: z.number().positive(),
    // foodId未指定時（手入力）は栄養値を直接指定する
    caloriesKcal: z.number().nonnegative().optional(),
    proteinG: z.number().nonnegative().optional(),
    fatG: z.number().nonnegative().optional(),
    carbsG: z.number().nonnegative().optional(),
  })
  .refine((item) => item.foodId || item.customName, {
    message: "Either foodId or customName is required",
  });

export const mealLogSchema = z.object({
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  loggedAt: z.string().datetime(),
  memo: z.string().optional(),
  items: z.array(mealLogItemSchema).min(1),
});

export const healthLogSchema = z.object({
  source: z.enum(["APPLE_HEALTH", "GOOGLE_FIT"]),
  dataType: z.enum(["STEPS", "ACTIVE_CALORIES", "WEIGHT"]),
  value: z.number(),
  recordedAt: z.string().datetime(),
});
