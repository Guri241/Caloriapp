import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { apiFetch } from "./client";
import type { MealLog, MealType } from "./types";

// 送信前に長辺1024pxまで縮小する。
// 解析精度はほぼ変わらず、通信量とAPIの入力トークン（＝原価）が大きく下がる。
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

export interface PreparedImage {
  base64: string;
  mediaType: "image/jpeg";
  previewUri: string;
}

async function prepare(uri: string): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri).resize({ width: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error("画像の変換に失敗しました");
  }

  return { base64: result.base64, mediaType: "image/jpeg", previewUri: result.uri };
}

// カメラで撮影する。権限が拒否された場合はnullを返す。
export async function captureMealPhoto(): Promise<PreparedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  return prepare(result.assets[0].uri);
}

// 撮影済みの写真をライブラリから選ぶ。
export async function pickMealPhoto(): Promise<PreparedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  return prepare(result.assets[0].uri);
}

export interface AnalyzedItem {
  name: string;
  amountG: number;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface AnalyzeResponse {
  analysisId: string;
  items: AnalyzedItem[];
  confidence: number;
  note: string;
  mealLog: MealLog | null;
  quota: { used: number; limit: number | null; remaining: number | null };
}

export interface AnalyzeInput {
  image: PreparedImage;
  hint?: string;
  autoCreate?: boolean;
  mealType?: MealType;
  loggedAt?: string;
}

export function useAnalyzeMealPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalyzeInput) =>
      apiFetch<AnalyzeResponse>("/api/meal-logs/analyze-photo", {
        method: "POST",
        body: {
          imageBase64: input.image.base64,
          mediaType: input.image.mediaType,
          hint: input.hint,
          autoCreate: input.autoCreate ?? false,
          mealType: input.mealType ?? "LUNCH",
          loggedAt: input.loggedAt,
        },
      }),
    // 解析は課金枠を消費するので、失敗しても自動で叩き直さない
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      if (data.mealLog) {
        queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
        queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
      }
    },
  });
}
