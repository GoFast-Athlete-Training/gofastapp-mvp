/**
 * Public "Hosted by" for staff-created shakeouts.
 * The host is an associated brand or club — never the staff person who saved the row.
 */

export type ShakeoutPublicHost = {
  name: string;
  logoUrl: string | null;
  kind: "brand" | "club";
};

export type ShakeoutPublicHostInput = {
  cityRunType?: string | null;
  organizerType?: string | null;
  organizerName?: string | null;
  runClub?: { name?: string | null; logoUrl?: string | null } | null;
  clubAssociation?: { nameSnapshot?: string | null; logoUrlSnapshot?: string | null } | null;
  shakeoutClubName?: string | null;
  runBrand?: { name?: string | null; logoUrl?: string | null } | null;
  runBrandName?: string | null;
  runBrandLogoUrl?: string | null;
  shakeoutSponsorName?: string | null;
};

function brandFrom(run: ShakeoutPublicHostInput): ShakeoutPublicHost | null {
  const name =
    run.runBrand?.name?.trim() ||
    run.runBrandName?.trim() ||
    run.shakeoutSponsorName?.trim() ||
    (run.organizerType === "brand" ? run.organizerName?.trim() : null) ||
    null;
  if (!name) return null;
  const logoUrl = run.runBrand?.logoUrl?.trim() || run.runBrandLogoUrl?.trim() || null;
  return { name, logoUrl, kind: "brand" };
}

function clubFrom(run: ShakeoutPublicHostInput): ShakeoutPublicHost | null {
  const name =
    run.runClub?.name?.trim() ||
    run.clubAssociation?.nameSnapshot?.trim() ||
    run.shakeoutClubName?.trim() ||
    (run.organizerType === "club" ? run.organizerName?.trim() : null) ||
    null;
  if (!name) return null;
  const logoUrl =
    run.runClub?.logoUrl?.trim() || run.clubAssociation?.logoUrlSnapshot?.trim() || null;
  return { name, logoUrl, kind: "club" };
}

/** Staff-marked host after Associate → Make host. Defaults to brand, then club. */
export function resolveShakeoutPublicHost(
  run: ShakeoutPublicHostInput,
): ShakeoutPublicHost | null {
  const kind = run.organizerType?.trim().toLowerCase();
  if (kind === "brand") return brandFrom(run);
  if (kind === "club") return clubFrom(run);

  if (run.cityRunType === "RACE_SHAKEOUT") {
    return brandFrom(run) ?? clubFrom(run);
  }
  return brandFrom(run) ?? clubFrom(run);
}
