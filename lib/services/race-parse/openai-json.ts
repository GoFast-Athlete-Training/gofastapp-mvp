import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function completeJsonObject(prompt: string): Promise<Record<string, unknown>> {
  const completion = await getOpenAIClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

export type VisionImageInput = {
  /** Raw base64 (no data: prefix) */
  base64?: string;
  /** e.g. image/png, image/jpeg — required with base64 */
  mime?: string;
  /** Public HTTPS URL (e.g. saved course map from blob storage) */
  url?: string;
};

function resolveVisionImageUrl(image: VisionImageInput): string | null {
  const url = image.url?.trim();
  if (url && /^https?:\/\//i.test(url)) {
    return url;
  }
  const b64 = image.base64?.trim();
  const mime = image.mime?.trim();
  if (b64 && mime) {
    return `data:${mime};base64,${b64.replace(/\s/g, "")}`;
  }
  return null;
}

/** Same as completeJsonObject but with configurable temperature (e.g. creative segment tips). */
/** Optional map image for vision models (gpt-4o, gpt-4o-mini, etc.). */
export async function completeJsonObjectAtTemperature(
  prompt: string,
  temperature: number,
  image?: VisionImageInput | null
): Promise<Record<string, unknown>> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const imageUrl = image ? resolveVisionImageUrl(image) : null;
  const userContent = imageUrl
    ? [
        { type: "text" as const, text: prompt },
        {
          type: "image_url" as const,
          image_url: {
            url: imageUrl,
            detail: "high" as const,
          },
        },
      ]
    : prompt;

  const completion = await getOpenAIClient().chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: userContent as string | OpenAI.Chat.ChatCompletionContentPart[],
      },
    ],
    response_format: { type: "json_object" },
    temperature,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from OpenAI");
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}
