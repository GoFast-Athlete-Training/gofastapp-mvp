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

/** Shared copy rules for road, park, trail, and shakeout descriptions. */
export const FIRST_PERSON_BAN = `Never use first or second person: no we, we'll, we're, our, us, your. Write in third person about the club or run. Do not write as GoFast or as the platform.`;

/** Track listings may address the reader. They must not speak as the club. */
export const CLUB_VOICE_BAN = `Do not write as the club or as GoFast. Never use we, we'll, we're, our, us, or let's. Name the club. Addressing the reader (Join {club}…, you) is fine.`;

export const TRACK_PUBLIC_DESCRIPTION_SYSTEM = `You write public-facing copy for a group track workout listing.

Output format (plain text, no markdown):
1. One inviting sentence that names the club and asks people to join that club for the session. Weave the day and meet-up into the sentence. A little warmth is fine, such as a night of track and camaraderie. Do not open with a dry fact line like "Club Name on October 6 at School. All paces welcome." Mention all paces only when pace is Various or all paces, inside the sentence if it fits.
2. Then one line per distinct workout piece, in order, in plain words. Examples: "Warmup: 1 mile", "2–3 × 1600m between 10K and 5K pace", "1000m at 5K pace", "Cooldown: 1 mile". Write paces in words. No @ shorthand and no arrows.
3. Do not invent reps, distances, paces, or intervals. Preserve ranges such as 2–3 as written. Do not fold the pieces back into the intro sentence.

Example:
Join Northeast Track Club this Tuesday at Eastern Senior High School for a night of track and camaraderie. All paces welcome.
Warmup: 1 mile
2–3 × 1600m between 10K and 5K pace
1000m at 5K pace
600m at 5K pace
Cooldown: 1 mile

${CLUB_VOICE_BAN}`;

export const TRACK_PUBLIC_DESCRIPTION_STRICT_RETRY = `${TRACK_PUBLIC_DESCRIPTION_SYSTEM}

CRITICAL: Your previous answer was wrong. Return ONLY the line-based format. At least one intro line plus separate lines for each workout piece. No single paragraph.`;

export function buildPublicDescriptionSystemPrompt(opts: {
  isShakeout: boolean;
  track: boolean;
}): string {
  if (opts.isShakeout) {
    return `You write public-facing copy for a race shakeout run (easy social run before a marathon or race).
Mention brand hosts, shoe try-ons, or swag only when the draft mentions them — do not invent perks.
2-4 sentences, factual, no markdown.
${FIRST_PERSON_BAN}`;
  }
  if (opts.track) {
    return TRACK_PUBLIC_DESCRIPTION_SYSTEM;
  }
  return `You write public-facing copy for a group run listing.
2-4 sentences, factual, no markdown. Include meet-up, distance, pace, and where the route goes when route notes are provided.
${FIRST_PERSON_BAN}`;
}

export function buildPublicDescriptionContextLines(
  input: PublicDescriptionGenerateInput,
  opts: { isShakeout: boolean; track: boolean; existing: string },
): string {
  const workoutBlock = opts.track
    ? [
        input.workoutTitle && `Attached workout title: ${input.workoutTitle}`,
        input.workoutDescription?.trim() &&
          `Workout session (one output line per distinct piece below — do not invent intervals not listed here):\n${input.workoutDescription.trim()}`,
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

  return [
    input.title && `Run title: ${input.title}`,
    opts.isShakeout && "Run type: race shakeout (pre-race shakeout run)",
    !opts.isShakeout && input.clubName && `Club: ${input.clubName}`,
    input.dateYmd && `Date: ${input.dateYmd}`,
    input.meetUpPoint && `Meet-up: ${input.meetUpPoint}`,
    input.totalMiles != null && input.totalMiles !== "" && `Distance: ${input.totalMiles} mi`,
    input.pace && `Pace: ${input.pace}`,
    input.postRunActivity && `Post-run: ${input.postRunActivity}`,
    input.runType && `Venue: ${input.runType}`,
    workoutBlock || null,
    opts.existing && `Draft to refine:\n${opts.existing}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPublicDescriptionUserMessage(
  mode: "smooth" | "from_core",
  existing: string,
  contextLines: string,
  track: boolean,
): string {
  if (mode === "smooth") {
    if (track) {
      return `Rewrite this public track description: one inviting sentence that names the club, then one plain-language line per workout piece. Do not open with a dry date-and-place fact line.\n\n${existing}\n\nContext:\n${contextLines}`;
    }
    return `Smooth and polish this public description:\n\n${existing}\n\nContext:\n${contextLines}`;
  }
  if (track) {
    return `Write a public track description from these core details: one inviting sentence that names the club, then one plain-language line per workout piece.\n\n${contextLines}`;
  }
  return `Write a public description from these core details:\n\n${contextLines}`;
}

const FIRST_PERSON_RE =
  /\b(we|we'll|we're|weve|we've|our|us|join us|let's|lets)\b/i;

/** Dry opener: "Club Name on October 6 at School." with no invite. */
const LITERAL_INTRO_RE =
  /\bon\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i;

export function trackIntroIsTooLiteral(text: string): boolean {
  const first = text.split(/\n/)[0]?.trim() ?? "";
  if (!first) return true;
  if (/\b(join|come join|night of|camaraderie)\b/i.test(first)) return false;
  return LITERAL_INTRO_RE.test(first);
}

export function containsBannedFirstPerson(text: string): boolean {
  return FIRST_PERSON_RE.test(text);
}

/** Heuristic: workout text likely describes multiple segments. */
export function workoutSessionHasMultiplePieces(workoutText: string | null | undefined): boolean {
  const t = workoutText?.trim() ?? "";
  if (!t) return false;
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) return true;
  const lower = t.toLowerCase();
  const segmentMarkers = [
    /\bwarm[- ]?up\b/,
    /\bcool[- ]?down\b/,
    /\d+\s*[–-]\s*\d+/,
    /\d+\s*[x×]\s*\d/,
    /\bintervals?\b/,
    /\b1600m\b/,
    /\b800m\b/,
    /\bfollowed by\b/,
    /,\s*(?:then|followed)/i,
  ];
  let hits = 0;
  for (const re of segmentMarkers) {
    if (re.test(lower)) hits += 1;
  }
  return hits >= 2;
}

export function trackDescriptionNeedsRetry(
  output: string,
  workoutDescription: string | null | undefined,
): boolean {
  const text = output.trim();
  if (!text) return true;
  if (containsBannedFirstPerson(text)) return true;
  if (trackIntroIsTooLiteral(text)) return true;
  if (!workoutSessionHasMultiplePieces(workoutDescription)) return false;
  const lineCount = text.split(/\n+/).filter((l) => l.trim()).length;
  if (lineCount < 3) return true;
  return false;
}
