type ShareTextInput = {
  runTitle: string;
  routeDescription?: string | null;
  cityRunType?: string | null;
  runClubName?: string | null;
  hostFirstName?: string | null;
};

/**
 * Computed invite share copy — not stored on city_runs.
 */
export function buildCityRunShareText(input: ShareTextInput): string {
  const title = input.runTitle?.trim() || "a run";
  const routeBlurb = input.routeDescription?.trim();
  const club = input.runClubName?.trim();
  const isClub = input.cityRunType === "CLUB" && club;

  if (isClub) {
    const lead = routeBlurb
      ? `Come join ${club} — ${routeBlurb}`
      : `Come join ${club} for ${title}.`;
    return lead;
  }

  const host = input.hostFirstName?.trim();
  if (routeBlurb) {
    return host
      ? `Come join me for ${title}. ${routeBlurb}`
      : `Come join me — ${routeBlurb}`;
  }
  return host ? `Come join me for ${title}.` : `Come join me for ${title}.`;
}
