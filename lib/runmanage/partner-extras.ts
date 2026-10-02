export const PARTNER_EXTRA_KINDS = ["CLUB", "BRAND", "STORE"] as const;
export type PartnerExtraKind = (typeof PARTNER_EXTRA_KINDS)[number];

export type PartnerExtra = {
  kind: PartnerExtraKind;
  refId: string;
  nameSnapshot: string;
  logoUrlSnapshot?: string | null;
};

export function parsePartnerExtras(raw: unknown): PartnerExtra[] {
  if (!Array.isArray(raw)) return [];
  const out: PartnerExtra[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind;
    const refId = o.refId;
    const nameSnapshot = o.nameSnapshot;
    if (
      typeof kind !== "string" ||
      !PARTNER_EXTRA_KINDS.includes(kind as PartnerExtraKind) ||
      typeof refId !== "string" ||
      !refId.trim() ||
      typeof nameSnapshot !== "string" ||
      !nameSnapshot.trim()
    ) {
      continue;
    }
    out.push({
      kind: kind as PartnerExtraKind,
      refId: refId.trim(),
      nameSnapshot: nameSnapshot.trim(),
      logoUrlSnapshot:
        o.logoUrlSnapshot === null || o.logoUrlSnapshot === undefined
          ? null
          : String(o.logoUrlSnapshot).trim() || null,
    });
  }
  return out;
}

export function partnerExtrasForWrite(raw: unknown): PartnerExtra[] | null {
  const parsed = parsePartnerExtras(raw);
  return parsed.length > 0 ? parsed : null;
}

export const STAFF_CREATE_RUN_TYPES = [
  "CLUB",
  "INDIVIDUAL",
  "RUN_STORE",
  "SPECIAL",
  "RACE_SHAKEOUT",
] as const;

export type StaffCreateRunType = (typeof STAFF_CREATE_RUN_TYPES)[number];

export function isStaffCreateRunType(v: unknown): v is StaffCreateRunType {
  return typeof v === "string" && (STAFF_CREATE_RUN_TYPES as readonly string[]).includes(v);
}

export function runTypeHasOpenAffiliations(type: StaffCreateRunType): boolean {
  return type === "SPECIAL" || type === "RACE_SHAKEOUT";
}
