import { getOpenAIClient } from "@/lib/services/race-parse/openai-json";
import { isTrackRun } from "@/lib/runTypes";

export type PublicDescriptionGenerateInput = {
  mode: "smooth" | "from_core";
  cityRunType?: string | null;
  clubName?: string | null;
  title?: string | null;
  existingDescription?: string | null;
  meetUpPoint?: string | null;
  totalMiles?: string | number | null;
  pace?: string | null;
  dateYmd?: string | null;
  postRunActivity?: string | null;
  runType?: string | null;
  routeNeighborhood?: string | null;
  workoutDescription?: string | null;
  workoutTitle?: string | null;
  routeDescription?: string | null;
};

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

  const workoutBlock = track
    ? [
        input.workoutTitle && `Attached workout title: ${input.workoutTitle}`,
        input.workoutDescription?.trim() &&
          `Workout session (include in public copy — do not invent intervals not listed here):\n${input.workoutDescription.trim()}`,
      ]
        .filter(Boolean)
        .join("\n")
    : [
        input.routeNeighborhood?.trim() && `Route area: ${input.routeNeighborhood.trim()}`,
        input.routeDescription?.trim() &&
          `Route notes (weave into public copy):\n${input.routeDescription.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");

  const contextLines = [
    input.title && `Run title: ${input.title}`,
    isShakeout && "Run type: race shakeout (pre-race shakeout run)",
    !isShakeout && input.clubName && `Club: ${input.clubName}`,
    input.dateYmd && `Date: ${input.dateYmd}`,
    input.meetUpPoint && `Meet-up: ${input.meetUpPoint}`,
    input.totalMiles != null && input.totalMiles !== "" && `Distance: ${input.totalMiles} mi`,
    input.pace && `Pace: ${input.pace}`,
    input.postRunActivity && `Post-run: ${input.postRunActivity}`,
    input.runType && `Venue: ${input.runType}`,
    workoutBlock || null,
    existing && `Draft to refine:\n${existing}`,
  ]
    .filter(Boolean)
    .join("\n");

  const system = isShakeout
    ? `You write public-facing copy for a race shakeout run (easy social run before a marathon or race).
Mention brand hosts, shoe try-ons, or swag only when the draft mentions them — do not invent perks.
2-4 sentences, friendly, no markdown.`
    : track
      ? `You write public-facing copy for a group track workout listing.
2-4 sentences, friendly, no markdown. Include meet-up and summarize the attached workout in plain language.
Do not invent reps, paces, or intervals that are not in the workout session text.`
      : `You write public-facing copy for a group run listing.
2-4 sentences, friendly, no markdown. Include meet-up, distance, pace, and where the route goes when route notes are provided.`;

  const user =
    input.mode === "smooth"
      ? `Smooth and polish this public description:\n\n${existing}\n\nContext:\n${contextLines}`
      : `Write a public description from these core details:\n\n${contextLines}`;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      max_tokens: 400,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { success: false, error: "Empty response from model." };
    return { success: true, description: text };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Generate failed.";
    return { success: false, error: message };
  }
}
