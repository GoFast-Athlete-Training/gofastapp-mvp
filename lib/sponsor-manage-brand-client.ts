import type { NextRequest } from "next/server";

export type SponsorManageBrandRow = {
  id: string;
  name: string;
  slug: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  logoUrl: string | null;
  brandType: string | null;
  description: string | null;
  city?: string | null;
  state?: string | null;
};

const STAFF_ID_HEADER = "x-gofast-staff-id";

function sponsorManageBaseUrl(): string | null {
  const base =
    process.env.GOFAST_SPONSOR_MANAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOFAST_SPONSOR_MANAGE_URL?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

export function resolveGofastTenantCompanyId(): string | null {
  return (
    process.env.GOFAST_GO_FAST_COMPANY_ID?.trim() ||
    process.env.GOFAST_TENANT_COMPANY_ID?.trim() ||
    null
  );
}

function staffForwardHeaders(request: NextRequest, staffId: string): HeadersInit {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing Bearer token");
  }
  return {
    Authorization: authorization,
    [STAFF_ID_HEADER]: staffId,
    Accept: "application/json",
  };
}

export async function searchSponsorManageBrands(
  request: NextRequest,
  staffId: string,
  opts: { q: string },
): Promise<{ ok: true; brands: SponsorManageBrandRow[] } | { ok: false; error: string }> {
  const base = sponsorManageBaseUrl();
  if (!base) {
    return { ok: false, error: "GOFAST_SPONSOR_MANAGE_URL is not configured" };
  }

  const params = new URLSearchParams({ search: opts.q.trim() });

  try {
    const res = await fetch(`${base}/api/brands?${params}`, {
      method: "GET",
      headers: staffForwardHeaders(request, staffId),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      brands?: SponsorManageBrandRow[];
      error?: string;
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json.error ?? "Brand search failed" };
    }
    return { ok: true, brands: json.brands ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Brand search failed";
    return { ok: false, error: msg };
  }
}

export async function upsertSponsorManageBrand(
  request: NextRequest,
  staffId: string,
  input: {
    name: string;
    slug?: string | null;
    websiteUrl?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    brandType?: string | null;
    city?: string | null;
    state?: string | null;
    instagramHandle?: string | null;
  },
): Promise<{ ok: true; brand: SponsorManageBrandRow } | { ok: false; error: string }> {
  const base = sponsorManageBaseUrl();
  if (!base) {
    return { ok: false, error: "GOFAST_SPONSOR_MANAGE_URL is not configured" };
  }

  try {
    const res = await fetch(`${base}/api/brands`, {
      method: "POST",
      headers: {
        ...staffForwardHeaders(request, staffId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      brand?: SponsorManageBrandRow;
      error?: string;
    };
    if (!res.ok || !json.success || !json.brand) {
      return { ok: false, error: json.error ?? "Brand upsert failed" };
    }
    return { ok: true, brand: json.brand };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Brand upsert failed";
    return { ok: false, error: msg };
  }
}

export async function patchSponsorManageBrand(
  request: NextRequest,
  staffId: string,
  brandId: string,
  patch: {
    name?: string;
    slug?: string | null;
    websiteUrl?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    brandType?: string | null;
    city?: string | null;
    state?: string | null;
  },
): Promise<{ ok: true; brand: SponsorManageBrandRow } | { ok: false; error: string }> {
  const base = sponsorManageBaseUrl();
  if (!base) {
    return { ok: false, error: "GOFAST_SPONSOR_MANAGE_URL is not configured" };
  }

  try {
    const res = await fetch(`${base}/api/brands/${encodeURIComponent(brandId)}`, {
      method: "PATCH",
      headers: {
        ...staffForwardHeaders(request, staffId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      brand?: SponsorManageBrandRow;
      error?: string;
    };
    if (!res.ok || !json.success || !json.brand) {
      return { ok: false, error: json.error ?? "Brand update failed" };
    }
    return { ok: true, brand: json.brand };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Brand update failed";
    return { ok: false, error: msg };
  }
}
