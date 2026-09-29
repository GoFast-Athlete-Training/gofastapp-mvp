export function getCompanyAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GOFAST_COMPANY_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_COMPANY_APP_URL?.replace(/\/$/, "") ||
    "https://gofasthq.gofastcrushgoals.com"
  );
}

export function getRunManageAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RUN_MANAGE_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_GOFAST_APP_URL?.replace(/\/$/, "") ||
    "https://runmanage.gofastcrushgoals.com"
  );
}

export function companyRunEditorPath(runId: string, clubId?: string | null): string {
  const base = getCompanyAppUrl();
  const params = new URLSearchParams({ mode: "edit" });
  if (clubId?.trim()) params.set("clubId", clubId.trim());
  return `${base}/dashboard/runs/manage/${encodeURIComponent(runId)}?${params.toString()}`;
}

export function runManageEditorPath(runId: string, mode: "view" | "edit" | "rsvps" = "edit"): string {
  const base = getRunManageAppUrl();
  const params = new URLSearchParams({ mode });
  return `${base}/runmanage/runs/${encodeURIComponent(runId)}?${params.toString()}`;
}
