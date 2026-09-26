export function getCompanyAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GOFAST_COMPANY_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_COMPANY_APP_URL?.replace(/\/$/, '') ||
    'https://gofasthq.gofastcrushgoals.com'
  );
}

export function companyRunEditorPath(runId: string, clubId?: string | null): string {
  const base = getCompanyAppUrl();
  const params = new URLSearchParams({ mode: 'edit' });
  if (clubId?.trim()) params.set('clubId', clubId.trim());
  return `${base}/dashboard/runs/manage/${encodeURIComponent(runId)}?${params.toString()}`;
}
