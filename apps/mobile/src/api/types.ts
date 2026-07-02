export type ActivityLevel =
  | "SEDENTARY"
  | "LIGHT"
  | "MODERATE"
  | "ACTIVE"
  | "VERY_ACTIVE";

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export interface User {
  id: string;
  email: string;
  name: string | null;
  birthDate: string | null;
  gender: string | null;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: Pick<User, "id" | "email" | "name">;
}

export interface WeightLog {
  id: string;
  userId: string;
  weightKg: number;
  bodyFatPct: number | null;
  recordedAt: string;
  source: string;
  createdAt: string;
}

export interface Food {
  id: string;
  userId: string | null;
  name: string;
  brand: string | null;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  servingSizeG: number | null;
  externalSource: string | null;
  externalId: string | null;
}

export interface MealLogItem {
  id: string;
  mealLogId: string;
  foodId: string | null;
  food: Food | null;
  customName: string | null;
  amountG: number;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MealLog {
  id: string;
  userId: string;
  mealType: MealType;
  loggedAt: string;
  memo: string | null;
  items: MealLogItem[];
}

export interface ExerciseLog {
  id: string;
  userId: string;
  exerciseName: string;
  durationMinutes: number | null;
  caloriesBurned: number;
  performedAt: string;
  source: string;
}

export interface Goal {
  id: string;
  userId: string;
  targetWeightKg: number;
  startWeightKg: number;
  startDate: string;
  targetDate: string | null;
  isActive: boolean;
  progressPct: number | null;
}

export interface DailySummary {
  id: string;
  userId: string;
  date: string;
  totalIntakeKcal: number;
  totalBurnedKcal: number;
  netCaloriesKcal: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
  latestWeightKg: number | null;
}
