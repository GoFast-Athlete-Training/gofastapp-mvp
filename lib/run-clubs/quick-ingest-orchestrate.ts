import { randomUUID } from "crypto";
import { internalApiHeaders } from "@/lib/internal-api-auth";

export type QuickIngestInput = {
  name: string;
  city: string;
  reference: string;
  state?: string | null;
  companyId: string;
  companyName?: string | null;
};

export type QuickIngestAuthForward = {
  authorization: string;
  staffId: string;
};

export type QuickIngestResult = {
  clubId: string;
  name: string;
  city: string;
  created: boolean;
};

const STAFF_ID_HEADER = "x-gofast-staff-id";

function clubManageBase(): string | null {
  const raw = process.env.GOFAST_CLUB_MANAGE_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

function prodApiBase(): string | null {
  const raw =
    process.env.GOFAST_APP_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_GO_FAST_API_BASE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!raw) return null;
  if (raw.startsWith("http")) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

async function postJson<T>(
  url: string,
  headers: HeadersInit,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, data };
}

export async function orchestrateQuickClubIngest(
  input: QuickIngestInput,
  auth: QuickIngestAuthForward,
): Promise<{ ok: true; result: QuickIngestResult } | { ok: false; status: number; error: string }> {
  const clubBase = clubManageBase();
  const prodApi = prodApiBase();
  if (!clubBase) {
    return { ok: false, status: 503, error: "GOFAST_CLUB_MANAGE_URL is not configured" };
  }
  if (!prodApi) {
    return { ok: false, status: 503, error: "Prod API base URL is not configured" };
  }

  const staffHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: auth.authorization,
    [STAFF_ID_HEADER]: auth.staffId,
  };

  const lookupBody = {
    name: input.name,
    city: input.city,
    reference: input.reference,
    companyId: input.companyId,
  };

  const clubLookup = await postJson<{
    success?: boolean;
    match?: { id: string; name: string; city: string | null } | null;
    error?: string;
  }>(`${clubBase}/api/club/identity-lookup`, staffHeaders, lookupBody);

  if (!clubLookup.ok || !clubLookup.data?.success) {
    return {
      ok: false,
      status: clubLookup.status || 502,
      error: clubLookup.data?.error ?? "Club identity lookup failed",
    };
  }

  const prodLookup = await postJson<{
    success?: boolean;
    match?: { id: string; name: string; city: string | null; slug?: string } | null;
    error?: string;
  }>(`${prodApi}/api/internal/run-clubs/identity-lookup`, internalApiHeaders(), lookupBody);

  if (!prodLookup.ok || !prodLookup.data?.success) {
    return {
      ok: false,
      status: prodLookup.status || 502,
      error: prodLookup.data?.error ?? "Prod identity lookup failed",
    };
  }

  const clubMatch = clubLookup.data.match;
  const prodMatch = prodLookup.data.match;

  let clubId: string;
  let created = true;

  if (clubMatch?.id) {
    clubId = clubMatch.id;
    created = false;
  } else if (prodMatch?.id) {
    clubId = prodMatch.id;
    created = false;
  } else {
    clubId = randomUUID();
  }

  const adoptExisting = Boolean(clubMatch?.id || prodMatch?.id);

  const quickClub = await postJson<{
    success?: boolean;
    club?: { id: string; name: string; city: string | null };
    created?: boolean;
    error?: string;
  }>(`${clubBase}/api/club/quick`, staffHeaders, {
    id: clubId,
    companyId: input.companyId,
    companyName: input.companyName ?? "GoFast",
    name: input.name,
    city: input.city,
    state: input.state ?? null,
    reference: input.reference,
    adoptExisting,
    existingId: adoptExisting ? clubId : undefined,
  });

  if (!quickClub.ok || !quickClub.data?.success || !quickClub.data.club) {
    return {
      ok: false,
      status: quickClub.status || 502,
      error: quickClub.data?.error ?? "Club quick create failed",
    };
  }

  if (typeof quickClub.data.created === "boolean" && !quickClub.data.created) {
    created = false;
  }

  const prodUpsert = await postJson<{ success?: boolean; error?: string }>(
    `${prodApi}/api/internal/run-clubs/identity-upsert`,
    internalApiHeaders(),
    {
      id: clubId,
      slug: prodMatch?.slug,
      name: input.name,
      city: input.city,
      reference: input.reference,
    },
  );

  if (!prodUpsert.ok || !prodUpsert.data?.success) {
    return {
      ok: false,
      status: prodUpsert.status || 502,
      error: prodUpsert.data?.error ?? "Prod club mirror failed",
    };
  }

  await postJson(`${clubBase}/api/club/quick`, staffHeaders, {
    id: clubId,
    companyId: input.companyId,
    companyName: input.companyName ?? "GoFast",
    name: input.name,
    city: input.city,
    state: input.state ?? null,
    reference: input.reference,
    adoptExisting: true,
    existingId: clubId,
    syncedToProd: true,
  });

  return {
    ok: true,
    result: {
      clubId,
      name: quickClub.data.club.name,
      city: quickClub.data.club.city ?? input.city,
      created,
    },
  };
}
