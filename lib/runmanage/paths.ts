export {
  runManageWelcomePath,
  runManageSignInPath,
  runManageSignInUrl,
  isRunManageRedirectPath,
  RUN_MANAGE_DASHBOARD_PATH,
} from '@/lib/runmanage/door';

export type RunInstanceManageMode = "view" | "edit" | "rsvps";

export function runManageCreatePath(opts?: {
  cityRunType?: string;
  clubId?: string | null;
  companyRaceId?: string | null;
  raceName?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts?.cityRunType?.trim()) params.set("cityRunType", opts.cityRunType.trim());
  if (opts?.clubId?.trim()) params.set("clubId", opts.clubId.trim());
  if (opts?.companyRaceId?.trim()) params.set("companyRaceId", opts.companyRaceId.trim());
  if (opts?.raceName?.trim()) params.set("raceName", opts.raceName.trim());
  const q = params.toString();
  return q ? `/runmanage/runs/new?${q}` : "/runmanage/runs/new";
}

export function runInstanceViewPath(runId: string, _clubId?: string | null): string {
  return `/runmanage/runs/${encodeURIComponent(runId)}?mode=view`;
}

export function runInstanceEditPath(runId: string, _clubId?: string | null): string {
  return `/runmanage/runs/${encodeURIComponent(runId)}?mode=edit`;
}

export function runInstanceRsvpsPath(runId: string, _clubId?: string | null): string {
  return `/runmanage/runs/${encodeURIComponent(runId)}?mode=rsvps`;
}
