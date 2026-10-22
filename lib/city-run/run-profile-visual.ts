export type RunProfileVisualInput = {
  profileEmoji?: string | null;
  coverPhotoUrl?: string | null;
  mapImageUrl?: string | null;
  runType?: string | null;
  runClub?: { logoUrl?: string | null } | null;
  hostPhotoUrl?: string | null;
  route?: { mapImageUrl?: string | null } | null;
};

export function isTrackRunType(runType: string | null | undefined): boolean {
  if (!runType?.trim()) return false;
  return runType.trim().toLowerCase() === "track";
}

export function resolveRouteMapImageUrl(input: {
  mapImageUrl?: string | null;
  runType?: string | null;
  route?: { mapImageUrl?: string | null } | null;
}): string | null {
  if (isTrackRunType(input.runType)) return null;
  return input.mapImageUrl?.trim() || input.route?.mapImageUrl?.trim() || null;
}

export type RunCircleMark =
  | { kind: "emoji"; value: string }
  | { kind: "image"; value: string; alt: string };

/** Circle mark for Links-style header: emoji → club logo → host photo. */
export function resolveRunCircleMark(input: RunProfileVisualInput): RunCircleMark | null {
  const emoji = input.profileEmoji?.trim();
  if (emoji) return { kind: "emoji", value: emoji };

  const clubLogo = input.runClub?.logoUrl?.trim();
  if (clubLogo) return { kind: "image", value: clubLogo, alt: "Club logo" };

  const hostPhoto = input.hostPhotoUrl?.trim();
  if (hostPhoto) return { kind: "image", value: hostPhoto, alt: "Host" };

  return null;
}

export type RunHeroImage = {
  url: string;
  source: "cover" | "routeMap";
};

/** Wide hero slot: cover photo wins; route map when no cover. */
export function resolveRunHeroImage(input: RunProfileVisualInput): RunHeroImage | null {
  const cover = input.coverPhotoUrl?.trim();
  if (cover) return { url: cover, source: "cover" };

  const map = resolveRouteMapImageUrl(input);
  if (map) return { url: map, source: "routeMap" };

  return null;
}

/** When hero uses route map, hide duplicate map in Route section. */
export function mapImageUrlForRouteSection(
  input: RunProfileVisualInput,
  hero: RunHeroImage | null,
): string | null {
  const map = resolveRouteMapImageUrl(input);
  if (!map) return null;
  if (hero?.source === "routeMap" && hero.url === map) return null;
  return map;
}

export function normalizeProfileEmoji(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 8);
}

type HostRsvpRow = {
  role?: string | null;
  Athlete?: { photoURL?: string | null } | null;
};

export function resolveHostPhotoUrlFromRsvps(
  rsvps: HostRsvpRow[] | null | undefined,
  isHostRole: (role: string | null | undefined) => boolean,
): string | null {
  if (!rsvps?.length) return null;
  const host = rsvps.find((r) => isHostRole(r.role));
  return host?.Athlete?.photoURL?.trim() || null;
}
