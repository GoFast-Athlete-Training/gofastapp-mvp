import type { CockpitBucket } from '@/lib/runmanage/run-cockpit-buckets';

export {
  runManageWelcomePath,
  runManageSignInPath,
  runManageSignInUrl,
  isRunManageRedirectPath,
  RUN_MANAGE_DASHBOARD_PATH,
} from '@/lib/runmanage/door';

export const RUN_MANAGE_SERIES_PATH = '/runmanage/series';
export const RUN_MANAGE_CLUBS_PATH = '/runmanage/clubs';

export function runManageTypePath(bucket: CockpitBucket): string {
  return `/runmanage/types/${bucket}`;
}

export function runManageClubHubPath(clubId: string): string {
  return `/runmanage/clubs/${encodeURIComponent(clubId.trim())}`;
}

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

export function runManageCreateFromSeriesPath(
  seriesId: string,
  opts?: { dateYmd?: string | null }
): string {
  const params = new URLSearchParams();
  params.set("mode", "series");
  params.set("seriesId", seriesId.trim());
  if (opts?.dateYmd?.trim()) params.set("dateYmd", opts.dateYmd.trim());
  return `/runmanage/runs/new?${params.toString()}`;
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
