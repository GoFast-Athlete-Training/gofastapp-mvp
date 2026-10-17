function trimOrNull(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  return s || null;
}

function normalizeInstagramHandle(raw: unknown): string | null {
  const s = trimOrNull(raw);
  if (!s) return null;
  return s.replace(/^@+/, "") || null;
}

function parseCoord(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

export type PostRunBrandStampFields = {
  postRunBrandId?: string | null;
  postRunBrandName?: string | null;
  postRunBrandLogoUrl?: string | null;
  postRunBrandWebsiteUrl?: string | null;
  postRunBrandInstagramHandle?: string | null;
  postRunBrandStreetAddress?: string | null;
  postRunBrandFormattedAddress?: string | null;
  postRunBrandPlaceId?: string | null;
  postRunBrandLat?: number | null;
  postRunBrandLng?: number | null;
  postRunBrandCity?: string | null;
  postRunBrandState?: string | null;
  postRunBrandZip?: string | null;
  postRunFoodKind?: string | null;
  postRunBrandShortDescription?: string | null;
  postRunActivity?: string | null;
};

const POST_RUN_STAMP_KEYS = [
  "postRunBrandName",
  "postRunBrandLogoUrl",
  "postRunBrandWebsiteUrl",
  "postRunBrandInstagramHandle",
  "postRunBrandStreetAddress",
  "postRunBrandFormattedAddress",
  "postRunBrandPlaceId",
  "postRunBrandLat",
  "postRunBrandLng",
  "postRunBrandCity",
  "postRunBrandState",
  "postRunBrandZip",
  "postRunFoodKind",
  "postRunBrandShortDescription",
] as const;

function clearPostRunBrandStamp(): PostRunBrandStampFields {
  const out: PostRunBrandStampFields = { postRunBrandId: null };
  for (const key of POST_RUN_STAMP_KEYS) {
    out[key] = null;
  }
  return out;
}

function stampFromPick(p: Record<string, unknown>): PostRunBrandStampFields {
  return {
    postRunBrandName: trimOrNull(p.name),
    postRunBrandLogoUrl: trimOrNull(p.logoUrl),
    postRunBrandWebsiteUrl: trimOrNull(p.websiteUrl),
    postRunBrandInstagramHandle: normalizeInstagramHandle(p.instagramHandle),
    postRunBrandStreetAddress: trimOrNull(p.streetAddress),
    postRunBrandFormattedAddress: trimOrNull(p.formattedAddress),
    postRunBrandPlaceId: trimOrNull(p.placeId),
    postRunBrandLat: parseCoord(p.lat),
    postRunBrandLng: parseCoord(p.lng),
    postRunBrandCity: trimOrNull(p.city),
    postRunBrandState: trimOrNull(p.state),
    postRunBrandZip: trimOrNull(p.zipCode),
    postRunFoodKind: trimOrNull(p.coffeeFoodKind),
    postRunBrandShortDescription: trimOrNull(p.shortDescription),
  };
}

export function formatPostRunActivityLabel(input: {
  name?: string | null;
  shortDescription?: string | null;
}): string | null {
  const name = input.name?.trim();
  if (!name) return null;
  const blurb = input.shortDescription?.trim();
  return blurb ? `${name} — ${blurb}` : name;
}

/** Prod brands row → frozen post-run stop fields on city_runs. */
export function postRunBrandStampFromProdBrand(row: {
  id: string;
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  streetAddress?: string | null;
  formattedAddress?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  coffeeFoodKind?: string | null;
  shortDescription?: string | null;
}): PostRunBrandStampFields {
  const stamped = stampFromPick({
    name: row.name,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
    instagramHandle: row.instagramHandle,
    streetAddress: row.streetAddress,
    formattedAddress: row.formattedAddress,
    placeId: row.placeId,
    lat: row.lat,
    lng: row.lng,
    zipCode: row.zipCode,
    city: row.city,
    state: row.state,
    coffeeFoodKind: row.coffeeFoodKind,
    shortDescription: row.shortDescription,
  });
  return {
    postRunBrandId: row.id,
    ...stamped,
    postRunActivity: formatPostRunActivityLabel({
      name: row.name,
      shortDescription: stamped.postRunBrandShortDescription,
    }),
  };
}

/** Stamp city run post-run stop from save payload (Sponsor Manage id + display fields). */
export function postRunBrandStampFieldsFromBody(
  body: Record<string, unknown>,
): PostRunBrandStampFields {
  let rawId = body.postRunBrandId;
  const pickOnly = body.postRunBrandPick;
  if (
    rawId === undefined &&
    pickOnly &&
    typeof pickOnly === "object" &&
    typeof (pickOnly as Record<string, unknown>).id === "string"
  ) {
    rawId = (pickOnly as Record<string, unknown>).id;
  }
  const out: PostRunBrandStampFields = {};

  if (rawId !== undefined) {
    out.postRunBrandId =
      rawId === null || rawId === "" ? null : String(rawId).trim() || null;
    if (out.postRunBrandId === null) {
      Object.assign(out, clearPostRunBrandStamp());
    }
  }

  if (out.postRunBrandId) {
    const pick = body.postRunBrandPick;
    if (pick && typeof pick === "object") {
      Object.assign(out, stampFromPick(pick as Record<string, unknown>));
    }

    if (body.postRunBrandName !== undefined) {
      out.postRunBrandName = trimOrNull(body.postRunBrandName);
    }
    if (body.postRunBrandLogoUrl !== undefined) {
      out.postRunBrandLogoUrl = trimOrNull(body.postRunBrandLogoUrl);
    }
    if (body.postRunBrandWebsiteUrl !== undefined) {
      out.postRunBrandWebsiteUrl = trimOrNull(body.postRunBrandWebsiteUrl);
    }
    if (body.postRunBrandInstagramHandle !== undefined) {
      out.postRunBrandInstagramHandle = normalizeInstagramHandle(body.postRunBrandInstagramHandle);
    }
    if (body.postRunBrandStreetAddress !== undefined) {
      out.postRunBrandStreetAddress = trimOrNull(body.postRunBrandStreetAddress);
    }
    if (body.postRunBrandFormattedAddress !== undefined) {
      out.postRunBrandFormattedAddress = trimOrNull(body.postRunBrandFormattedAddress);
    }
    if (body.postRunBrandPlaceId !== undefined) {
      out.postRunBrandPlaceId = trimOrNull(body.postRunBrandPlaceId);
    }
    if (body.postRunBrandLat !== undefined) {
      out.postRunBrandLat = parseCoord(body.postRunBrandLat);
    }
    if (body.postRunBrandLng !== undefined) {
      out.postRunBrandLng = parseCoord(body.postRunBrandLng);
    }
    if (body.postRunBrandCity !== undefined) {
      out.postRunBrandCity = trimOrNull(body.postRunBrandCity);
    }
    if (body.postRunBrandState !== undefined) {
      out.postRunBrandState = trimOrNull(body.postRunBrandState);
    }
    if (body.postRunBrandZip !== undefined) {
      out.postRunBrandZip = trimOrNull(body.postRunBrandZip);
    }
    if (body.postRunFoodKind !== undefined) {
      out.postRunFoodKind = trimOrNull(body.postRunFoodKind);
    }
    if (body.postRunBrandShortDescription !== undefined) {
      out.postRunBrandShortDescription = trimOrNull(body.postRunBrandShortDescription);
    }

    out.postRunActivity = formatPostRunActivityLabel({
      name: out.postRunBrandName,
      shortDescription: out.postRunBrandShortDescription,
    });
  } else if (rawId !== undefined && out.postRunBrandId === null) {
    if (body.postRunActivity !== undefined) {
      out.postRunActivity = trimOrNull(body.postRunActivity);
    }
  }

  return out;
}

export function postRunBrandPickFromRunStamp(run: {
  postRunBrandId?: string | null;
  postRunBrandName?: string | null;
  postRunBrandLogoUrl?: string | null;
  postRunBrandWebsiteUrl?: string | null;
  postRunBrandInstagramHandle?: string | null;
  postRunBrandStreetAddress?: string | null;
  postRunBrandFormattedAddress?: string | null;
  postRunBrandPlaceId?: string | null;
  postRunBrandLat?: number | null;
  postRunBrandLng?: number | null;
  postRunBrandCity?: string | null;
  postRunBrandState?: string | null;
  postRunBrandZip?: string | null;
  postRunFoodKind?: string | null;
  postRunBrandShortDescription?: string | null;
}): {
  id: string;
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  streetAddress?: string | null;
  formattedAddress?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  coffeeFoodKind?: string | null;
  shortDescription?: string | null;
} | null {
  const id = run.postRunBrandId?.trim();
  const name = run.postRunBrandName?.trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    logoUrl: run.postRunBrandLogoUrl,
    websiteUrl: run.postRunBrandWebsiteUrl,
    instagramHandle: run.postRunBrandInstagramHandle,
    streetAddress: run.postRunBrandStreetAddress,
    formattedAddress: run.postRunBrandFormattedAddress,
    placeId: run.postRunBrandPlaceId,
    lat: run.postRunBrandLat,
    lng: run.postRunBrandLng,
    city: run.postRunBrandCity,
    state: run.postRunBrandState,
    zipCode: run.postRunBrandZip,
    coffeeFoodKind: run.postRunFoodKind,
    shortDescription: run.postRunBrandShortDescription,
  };
}

export const postRunBrandProdSelect = {
  id: true,
  name: true,
  logoUrl: true,
  websiteUrl: true,
  instagramHandle: true,
  streetAddress: true,
  formattedAddress: true,
  placeId: true,
  lat: true,
  lng: true,
  zipCode: true,
  city: true,
  state: true,
  coffeeFoodKind: true,
  shortDescription: true,
} as const;
