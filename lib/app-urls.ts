export function getRunManageAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RUN_MANAGE_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_GOFAST_APP_URL?.replace(/\/$/, "") ||
    "https://runmanage.gofastcrushgoals.com"
  );
}

export function runManageEditorPath(runId: string, mode: "view" | "edit" | "rsvps" = "edit"): string {
  const base = getRunManageAppUrl();
  const params = new URLSearchParams({ mode });
  return `${base}/runmanage/runs/${encodeURIComponent(runId)}?${params.toString()}`;
}
