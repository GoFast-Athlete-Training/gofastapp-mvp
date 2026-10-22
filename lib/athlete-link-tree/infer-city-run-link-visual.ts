import { normalizeProfileEmoji } from "@/lib/city-run/run-profile-visual";

export type CityRunLinkVisual = {
  linkLogoUrl: string | null;
  emoji: string | null;
};

function firstUrlFromPhotoJson(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return null;
}

/** Button art for a hosted run on athletelinks — run photo/map when present, else 🏃. */
export function inferCityRunLinkVisual(run: {
  mapImageUrl?: string | null;
  routePhotos?: unknown;
  runPhotos?: unknown;
  igPostGraphic?: string | null;
  profileEmoji?: string | null;
}): CityRunLinkVisual {
  const candidates = [
    run.mapImageUrl,
    firstUrlFromPhotoJson(run.routePhotos),
    firstUrlFromPhotoJson(run.runPhotos),
    run.igPostGraphic,
  ];

  for (const raw of candidates) {
    const url = raw?.trim();
    if (url) {
      return { linkLogoUrl: url, emoji: null };
    }
  }

  const profileEmoji = normalizeProfileEmoji(run.profileEmoji);
  if (profileEmoji) {
    return { linkLogoUrl: null, emoji: profileEmoji };
  }

  return { linkLogoUrl: null, emoji: "🏃" };
}
