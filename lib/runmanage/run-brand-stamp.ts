function normalizeInstagramHandle(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim().replace(/^@+/, "");
  return s || null;
}

export type RunBrandStampFields = {
  runBrandId?: string | null;
  runBrandName?: string | null;
  runBrandLogoUrl?: string | null;
  runBrandWebsiteUrl?: string | null;
  runBrandInstagramHandle?: string | null;
};

/** Stamp city run brand display from save payload (Sponsor Manage id + display fields). */
export function runBrandStampFieldsFromBody(body: Record<string, unknown>): RunBrandStampFields {
  const rawId =
    body.runBrandId !== undefined ? body.runBrandId : body.partnerBrandId;
  const out: RunBrandStampFields = {};

  if (rawId !== undefined) {
    out.runBrandId =
      rawId === null || rawId === ""
        ? null
        : String(rawId).trim() || null;
    if (out.runBrandId === null) {
      out.runBrandName = null;
      out.runBrandLogoUrl = null;
      out.runBrandWebsiteUrl = null;
      out.runBrandInstagramHandle = null;
    }
  }

  const nameRaw = body.runBrandName ?? body.runBrandLabel;
  if (nameRaw !== undefined) {
    out.runBrandName =
      nameRaw === null || nameRaw === ""
        ? null
        : String(nameRaw).trim() || null;
  }

  const logoRaw = body.runBrandLogoUrl;
  if (logoRaw !== undefined) {
    out.runBrandLogoUrl =
      logoRaw === null || logoRaw === ""
        ? null
        : String(logoRaw).trim() || null;
  }

  const websiteRaw = body.runBrandWebsiteUrl;
  if (websiteRaw !== undefined) {
    out.runBrandWebsiteUrl =
      websiteRaw === null || websiteRaw === ""
        ? null
        : String(websiteRaw).trim() || null;
  }

  const igRaw = body.runBrandInstagramHandle;
  if (igRaw !== undefined) {
    out.runBrandInstagramHandle = normalizeInstagramHandle(igRaw);
  }

  const pick = body.runBrandPick;
  if (pick && typeof pick === "object" && out.runBrandId !== undefined && out.runBrandId !== null) {
    const p = pick as Record<string, unknown>;
    if (out.runBrandName === undefined && typeof p.name === "string" && p.name.trim()) {
      out.runBrandName = p.name.trim();
    }
    if (out.runBrandLogoUrl === undefined && p.logoUrl != null) {
      const logo = String(p.logoUrl).trim();
      out.runBrandLogoUrl = logo || null;
    }
    if (out.runBrandWebsiteUrl === undefined && p.websiteUrl != null) {
      const url = String(p.websiteUrl).trim();
      out.runBrandWebsiteUrl = url || null;
    }
    if (out.runBrandInstagramHandle === undefined && p.instagramHandle != null) {
      out.runBrandInstagramHandle = normalizeInstagramHandle(p.instagramHandle);
    }
  }

  return out;
}

export function attachRunBrandSnap<
  T extends {
    runBrandId?: string | null;
    runBrandName?: string | null;
    runBrandLogoUrl?: string | null;
    runBrandWebsiteUrl?: string | null;
    runBrandInstagramHandle?: string | null;
    runBrand?: {
      id?: string;
      name?: string | null;
      logoUrl?: string | null;
      websiteUrl?: string | null;
      instagramHandle?: string | null;
    } | null;
  },
>(run: T): T {
  if (
    run.runBrandName?.trim() ||
    run.runBrandLogoUrl?.trim() ||
    run.runBrandWebsiteUrl?.trim() ||
    run.runBrandInstagramHandle?.trim()
  ) {
    return {
      ...run,
      runBrand: {
        id: run.runBrandId ?? undefined,
        name: run.runBrandName?.trim() ?? null,
        logoUrl: run.runBrandLogoUrl?.trim() ?? null,
        websiteUrl:
          run.runBrandWebsiteUrl?.trim() ?? run.runBrand?.websiteUrl?.trim() ?? null,
        instagramHandle:
          run.runBrandInstagramHandle?.trim() ??
          run.runBrand?.instagramHandle?.trim() ??
          null,
      },
    };
  }
  return run;
}

export function cityRunBrandDisplay(run: {
  runBrandName?: string | null;
  runBrandLogoUrl?: string | null;
  runBrandWebsiteUrl?: string | null;
  runBrandInstagramHandle?: string | null;
  runBrand?: {
    name?: string | null;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    instagramHandle?: string | null;
  } | null;
}): {
  name: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
} {
  const name = run.runBrandName?.trim() || run.runBrand?.name?.trim() || null;
  const logoUrl = run.runBrandLogoUrl?.trim() || run.runBrand?.logoUrl?.trim() || null;
  const websiteUrl =
    run.runBrandWebsiteUrl?.trim() || run.runBrand?.websiteUrl?.trim() || null;
  const instagramHandle =
    run.runBrandInstagramHandle?.trim() ||
    run.runBrand?.instagramHandle?.trim() ||
    null;
  return { name, logoUrl, websiteUrl, instagramHandle };
}
