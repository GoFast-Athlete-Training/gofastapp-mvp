import { internalApiHeaders } from "@/lib/internal-api-auth";

export type SponsorManageBrandRow = {
  id: string;
  kind: string;
  name: string;
  slug: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  brandType: string | null;
  description: string | null;
};

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

export async function searchSponsorManageBrands(opts: {
  q: string;
  gofastCompanyId?: string | null;
  limit?: number;
}): Promise<{ ok: true; companies: SponsorManageBrandRow[] } | { ok: false; error: string }> {
  const base = sponsorManageBaseUrl();
  if (!base) {
    return { ok: false, error: "GOFAST_SPONSOR_MANAGE_URL is not configured" };
  }

  const params = new URLSearchParams({
    kind: "BRAND",
    q: opts.q.trim(),
    limit: String(opts.limit ?? 20),
  });
  if (opts.gofastCompanyId?.trim()) {
    params.set("gofastCompanyId", opts.gofastCompanyId.trim());
  }

  try {
    const res = await fetch(`${base}/api/internal/companies/search?${params}`, {
      method: "GET",
      headers: internalApiHeaders(),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      companies?: SponsorManageBrandRow[];
      error?: string;
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json.error ?? "Brand search failed" };
    }
    return { ok: true, companies: json.companies ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Brand search failed";
    return { ok: false, error: msg };
  }
}

export async function upsertSponsorManageBrand(input: {
  id?: string;
  gofastCompanyId: string;
  name: string;
  slug?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  brandType?: string | null;
}): Promise<{ ok: true; company: SponsorManageBrandRow } | { ok: false; error: string }> {
  const base = sponsorManageBaseUrl();
  if (!base) {
    return { ok: false, error: "GOFAST_SPONSOR_MANAGE_URL is not configured" };
  }

  try {
    const res = await fetch(`${base}/api/internal/companies/upsert`, {
      method: "POST",
      headers: internalApiHeaders(),
      body: JSON.stringify({
        id: input.id,
        gofastCompanyId: input.gofastCompanyId,
        kind: "BRAND",
        name: input.name,
        slug: input.slug ?? null,
        websiteUrl: input.websiteUrl ?? null,
        logoUrl: input.logoUrl ?? null,
        description: input.description ?? null,
        brandType: input.brandType ?? null,
      }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      company?: SponsorManageBrandRow;
      error?: string;
    };
    if (!res.ok || !json.success || !json.company) {
      return { ok: false, error: json.error ?? "Brand upsert failed" };
    }
    return { ok: true, company: json.company };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Brand upsert failed";
    return { ok: false, error: msg };
  }
}

export async function patchSponsorManageBrand(
  brandId: string,
  patch: {
    name?: string;
    slug?: string | null;
    websiteUrl?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    brandType?: string | null;
  },
): Promise<{ ok: true; company: SponsorManageBrandRow } | { ok: false; error: string }> {
  const base = sponsorManageBaseUrl();
  if (!base) {
    return { ok: false, error: "GOFAST_SPONSOR_MANAGE_URL is not configured" };
  }

  try {
    const res = await fetch(`${base}/api/internal/companies/${encodeURIComponent(brandId)}`, {
      method: "PATCH",
      headers: internalApiHeaders(),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      company?: SponsorManageBrandRow;
      error?: string;
    };
    if (!res.ok || !json.success || !json.company) {
      return { ok: false, error: json.error ?? "Brand update failed" };
    }
    return { ok: true, company: json.company };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Brand update failed";
    return { ok: false, error: msg };
  }
}
