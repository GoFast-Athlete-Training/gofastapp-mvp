import {
  inferDistanceLabelFromRaceName,
  inferDistanceMetersFromLabel,
  metersForCanonicalDistanceLabel,
} from "@/lib/training/race-distance-infer";

function inferFromSlug(slug: string | null | undefined): {
  distanceLabel: string | null;
  distanceMeters: number | null;
} {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s) return { distanceLabel: null, distanceMeters: null };
  if (/\bfull[\s-]?marathon\b/.test(s) || (/\bmarathon\b/.test(s) && !/\bhalf\b/.test(s))) {
    const label = "Marathon";
    return { distanceLabel: label, distanceMeters: metersForCanonicalDistanceLabel(label) };
  }
  if (/\bhalf[\s-]?marathon\b/.test(s) || /\bhalf\b/.test(s)) {
    const label = "Half Marathon";
    return { distanceLabel: label, distanceMeters: metersForCanonicalDistanceLabel(label) };
  }
  return { distanceLabel: null, distanceMeters: null };
}

/** Distance for pace math on My Race Hub — registry, claim, then slug/name hints. */
export function resolveMyRacePlannerDistance(params: {
  registryMeters: number | null | undefined;
  registryLabel: string | null | undefined;
  claimMeters?: number | null | undefined;
  claimLabel?: string | null | undefined;
  slug?: string | null | undefined;
  raceName?: string | null | undefined;
}): { distanceLabel: string | null; distanceMeters: number | null } {
  const claimM =
    params.claimMeters != null && params.claimMeters > 0 ? params.claimMeters : null;
  let regM =
    params.registryMeters != null && params.registryMeters > 0
      ? params.registryMeters
      : null;
  const claimLabelEarly = params.claimLabel?.trim() || null;
  const regLabelEarly = params.registryLabel?.trim() || null;
  const tenMileHint =
    inferDistanceLabelFromRaceName(params.raceName) === "10 Mile" ||
    inferDistanceMetersFromLabel(claimLabelEarly ?? regLabelEarly ?? "") ===
      Math.round(10 * 1609.344);
  if (regM === 10000 && tenMileHint) {
    regM = Math.round(10 * 1609.344);
  }
  const meters = claimM ?? regM ?? null;

  const claimLabel = params.claimLabel?.trim() || null;
  const regLabel = params.registryLabel?.trim() || null;
  let label = claimLabel ?? regLabel ?? null;

  if (meters == null || label == null || inferDistanceMetersFromLabel(label) == null) {
    const fromName = inferDistanceLabelFromRaceName(params.raceName);
    const fromSlug = inferFromSlug(params.slug);
    label = label ?? fromName ?? fromSlug.distanceLabel;
    const inferredMeters =
      meters ??
      (label ? inferDistanceMetersFromLabel(label) : null) ??
      fromSlug.distanceMeters ??
      (fromName ? metersForCanonicalDistanceLabel(fromName) : null);
    return { distanceLabel: label, distanceMeters: inferredMeters };
  }

  return { distanceLabel: label, distanceMeters: meters };
}
