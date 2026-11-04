/** Shared Run Manage URL scope — region required for data; city narrows within region. */
export type RunManageScope = {
  region: string;
  city: string;
};

export function scopeFromSearchParams(
  params: URLSearchParams | { get: (key: string) => string | null }
): RunManageScope {
  return {
    region: params.get("region")?.trim() || "",
    city: params.get("city")?.trim() || "",
  };
}

export function scopeToSearchParams(scope: RunManageScope): URLSearchParams {
  const p = new URLSearchParams();
  if (scope.region) p.set("region", scope.region);
  if (scope.city) p.set("city", scope.city);
  return p;
}

export function appendScopeToPath(path: string, scope: RunManageScope): string {
  const base = path.split("?")[0] ?? path;
  const existing = new URLSearchParams(path.includes("?") ? path.split("?")[1] : "");
  if (scope.region) existing.set("region", scope.region);
  else existing.delete("region");
  if (scope.city) existing.set("city", scope.city);
  else existing.delete("city");
  const q = existing.toString();
  return q ? `${base}?${q}` : base;
}

export function scopeQueryString(scope: RunManageScope): string {
  return scopeToSearchParams(scope).toString();
}
