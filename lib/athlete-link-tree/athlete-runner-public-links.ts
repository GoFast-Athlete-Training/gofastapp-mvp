import { runnerPublicLandingUrl } from "@/lib/gofast-with-me/runner-public-url";

/** Absolute public URL on the runner host for this athlete's landing or subpage. */
export function athleteRunnerPublicUrl(publicSlug: string, segment?: string): string {
  const base = runnerPublicLandingUrl(publicSlug).replace(/\/$/, "");
  if (!segment?.trim()) return base;
  return `${base}/${segment.trim().replace(/^\/+/, "")}`;
}

export type AthleteContentLinkPresetId =
  | "landing"
  | "story"
  | "reflections"
  | "thoughts"
  | "runs";

export type AthleteLinkSourceCardId =
  | AthleteContentLinkPresetId
  | "races"
  | "hostedRuns"
  | "routes"
  | "custom";

export const ATHLETE_LINK_SOURCE_CARDS: Array<{
  id: AthleteLinkSourceCardId;
  title: string;
  hint: string;
}> = [
  {
    id: "landing",
    title: "My GoFast Hub",
    hint: "GoFast With Me door — add at Top (no section heading)",
  },
  { id: "story", title: "My run story", hint: "Add your published story under a section" },
  {
    id: "reflections",
    title: "Training reflections",
    hint: "Pick published reflections under a section heading",
  },
  { id: "thoughts", title: "Think pieces", hint: "Pick published think pieces under a section heading" },
  {
    id: "runs",
    title: "Upcoming runs",
    hint: "Hosted runs list — add at Top or under a section",
  },
  {
    id: "hostedRuns",
    title: "Runs I created",
    hint: "Hosted run invites — not plan workouts (newest first)",
  },
  { id: "races", title: "Races", hint: "Check claimed races under a section heading" },
  { id: "routes", title: "Route", hint: "Pick a saved Strava route" },
  { id: "custom", title: "Custom link", hint: "Any URL" },
];

export const PRESET_EMOJI: Record<AthleteContentLinkPresetId, string> = {
  landing: "✨",
  story: "📖",
  reflections: "📝",
  thoughts: "💭",
  runs: "🏃",
};

export function presetLinkForId(
  id: AthleteContentLinkPresetId,
  publicSlug: string,
): { title: string; url: string; emoji: string } {
  switch (id) {
    case "landing":
      return {
        title: "My GoFast Hub",
        url: athleteRunnerPublicUrl(publicSlug),
        emoji: PRESET_EMOJI.landing,
      };
    case "story":
      return {
        title: "My run story",
        url: athleteRunnerPublicUrl(publicSlug, "story"),
        emoji: PRESET_EMOJI.story,
      };
    case "reflections":
      return {
        title: "Training reflections",
        url: athleteRunnerPublicUrl(publicSlug, "reflections"),
        emoji: PRESET_EMOJI.reflections,
      };
    case "thoughts":
      return {
        title: "Think pieces",
        url: athleteRunnerPublicUrl(publicSlug, "thoughts"),
        emoji: PRESET_EMOJI.thoughts,
      };
    case "runs":
      return {
        title: "Upcoming runs",
        url: athleteRunnerPublicUrl(publicSlug, "runs"),
        emoji: PRESET_EMOJI.runs,
      };
  }
}

export function normalizeLinkUrlForCompare(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}
