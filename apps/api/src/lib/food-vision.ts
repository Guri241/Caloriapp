import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ApiError } from "./api-response";

// ------------------------------------------
// 食事写真の解析（有料プランの中核機能）
// 「手入力が面倒で続かない」というこのカテゴリ最大の離脱理由を消すための機能。
// 原価が乗る唯一の処理なので、モデルと使用量は環境変数と月次上限で制御する。
// ------------------------------------------

// 既定はClaude Opus 5。原価と精度のバランスを変えたい場合は環境変数で差し替える
// （1解析あたりの試算はMONETIZATION.mdを参照）。
const DEFAULT_MODEL = "claude-opus-5";

export const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

// 解析結果のスキーマ。structured outputsでこの形を保証させ、
// パース失敗による無駄な再解析（＝原価の二重取り）を防ぐ。
const analysisSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("料理名。日本語で簡潔に（例: 白米、鶏の唐揚げ）"),
      amountG: z.number().describe("写真から推定した実際の量（グラム）"),
      caloriesKcal: z.number().describe("その量あたりの推定カロリー（kcal）"),
      proteinG: z.number().describe("その量あたりの推定たんぱく質（g）"),
      fatG: z.number().describe("その量あたりの推定脂質（g）"),
      carbsG: z.number().describe("その量あたりの推定炭水化物（g）"),
    }),
  ),
  confidence: z.number().describe("推定全体の確信度。0.0から1.0"),
  note: z.string().describe("ユーザーに見せる注記。分量の前提や不確実な点を1-2文で"),
});

export type FoodAnalysis = z.infer<typeof analysisSchema>;

export interface AnalyzeResult {
  analysis: FoodAnalysis;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `あなたは日本の食事写真から栄養を推定する管理栄養士です。

推定の方針:
- 写真に写っている料理を品目ごとに分解する（例: 定食なら「白米」「味噌汁」「焼き鮭」を別々に）
- 食器の大きさ、箸、手などを手がかりに分量をグラムで推定する
- コンビニ商品やチェーン店のメニューが特定できる場合は、その商品の標準的な栄養値を使う
- 栄養値は「100gあたり」ではなく「推定した実際の量あたり」で返す
- 飲み物も品目に含める（水・お茶など栄養が実質ゼロのものは除く）
- 食べ物が写っていない場合は items を空配列にし、note にその旨を書く

確信度の目安:
- 0.8以上: 料理も分量も明確
- 0.5-0.8: 料理は分かるが分量が推定
- 0.5未満: 隠れている・重なっている・判別しにくい

分量が推定に頼った場合は、note で必ずその前提を伝える。
ユーザーが後から手で直せるよう、断定しすぎない書き方にする。`;

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ApiError(500, "ANTHROPIC_API_KEY environment variable is not set");
  }
  cachedClient = new Anthropic();
  return cachedClient;
}

export async function analyzeFoodPhoto(
  imageBase64: string,
  mediaType: SupportedMediaType,
  hint?: string,
): Promise<AnalyzeResult> {
  const client = getClient();
  const model = process.env.FOOD_VISION_MODEL ?? DEFAULT_MODEL;

  const response = await client.messages.parse({
    model,
    // 数品目のJSONしか返さないので出力上限は小さくてよい（レイテンシと原価の両方に効く）
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    // 知覚と概算が中心のタスクなので、思考は中程度で足りる。
    output_config: { effort: "medium", format: zodOutputFormat(analysisSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text: hint
              ? `この食事の栄養を推定してください。ユーザーからの補足: ${hint}`
              : "この食事の栄養を推定してください。",
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new ApiError(422, "The image could not be analyzed", {
      code: "analysis_refused",
    });
  }

  const analysis = response.parsed_output;
  if (!analysis) {
    throw new ApiError(502, "Failed to parse the analysis result");
  }

  return {
    analysis,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
