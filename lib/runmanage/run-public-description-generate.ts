import { getOpenAIClient } from "@/lib/services/race-parse/openai-json";
import { isTrackRun } from "@/lib/runTypes";
import {
  buildPublicDescriptionContextLines,
  buildPublicDescriptionSystemPrompt,
  buildPublicDescriptionUserMessage,
  TRACK_PUBLIC_DESCRIPTION_STRICT_RETRY,
  trackDescriptionNeedsRetry,
  type PublicDescriptionGenerateInput,
} from "./run-public-description-prompts";

export type { PublicDescriptionGenerateInput };

async function callDescriptionModel(
  system: string,
  user: string,
  temperature: number,
): Promise<string | null> {
  const completion = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens: 400,
  });
  return completion.choices[0]?.message?.content?.trim() ?? null;
}

export async function generatePublicRunDescription(
  input: PublicDescriptionGenerateInput,
): Promise<{ success: true; description: string } | { success: false; error: string }> {
  const isShakeout = input.cityRunType === "RACE_SHAKEOUT";
  const existing = input.existingDescription?.trim() ?? "";
  const track = isTrackRun(input.runType);

  if (input.mode === "smooth" && !existing) {
    return { success: false, error: "Type or paste a rough description first." };
  }

  if (input.mode === "from_core" && !input.meetUpPoint?.trim()) {
    return { success: false, error: "Add meet-up and core details first." };
  }

  const contextLines = buildPublicDescriptionContextLines(input, {
    isShakeout,
    track,
    existing,
  });

  const system = buildPublicDescriptionSystemPrompt({ isShakeout, track });
  const user = buildPublicDescriptionUserMessage(input.mode, existing, contextLines, track);
  const temperature = track ? 0.2 : 0.6;

  try {
    let text = await callDescriptionModel(system, user, temperature);
    if (!text) return { success: false, error: "Empty response from model." };

    if (
      track &&
      trackDescriptionNeedsRetry(text, input.workoutDescription ?? existing)
    ) {
      const retryUser = `${user}\n\nPrevious attempt (invalid — fix format and voice):\n${text}`;
      const retryText = await callDescriptionModel(
        TRACK_PUBLIC_DESCRIPTION_STRICT_RETRY,
        retryUser,
        0.1,
      );
      if (retryText) text = retryText;
    }

    if (!text.trim()) return { success: false, error: "Empty response from model." };
    return { success: true, description: text.trim() };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Generate failed.";
    return { success: false, error: message };
  }
}
