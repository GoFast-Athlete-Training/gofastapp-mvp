const DEFAULT_COMPANY_ORIGIN = "https://gofasthq.gofastcrushgoals.com";
const DEFAULT_APP_MANAGEMENT_ORIGIN = "https://appmanage.gofastcrushgoals.com";

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function getCompanyAdminAllowedOrigins(): string[] {
  const origins = new Set<string>([
    normalizeOrigin(process.env.NEXT_PUBLIC_COMPANY_APP_URL) ?? DEFAULT_COMPANY_ORIGIN,
    normalizeOrigin(process.env.COMPANY_APP_URL) ?? DEFAULT_COMPANY_ORIGIN,
    normalizeOrigin(process.env.NEXT_PUBLIC_GOFAST_APP_MANAGEMENT_URL) ??
      DEFAULT_APP_MANAGEMENT_ORIGIN,
    normalizeOrigin(process.env.GOFAST_APP_MANAGEMENT_URL) ?? DEFAULT_APP_MANAGEMENT_ORIGIN,
  ]);

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3020");
  }

  return [...origins];
}

export function resolveCompanyAdminCorsOrigin(request: Request): string {
  const origin = request.headers.get("origin")?.trim();
  const allowed = getCompanyAdminAllowedOrigins();
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] ?? DEFAULT_COMPANY_ORIGIN;
}

export function companyAdminCorsHeaders(request: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveCompanyAdminCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gofast-staff-id",
    "Access-Control-Max-Age": "86400",
  };
}
