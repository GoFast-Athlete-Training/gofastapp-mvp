export type RunInstanceManageMode = "view" | "edit" | "rsvps";

export function runInstanceViewPath(runId: string, _clubId?: string | null): string {
  return `/runmanage/runs/${encodeURIComponent(runId)}?mode=view`;
}

export function runInstanceEditPath(runId: string, _clubId?: string | null): string {
  return `/runmanage/runs/${encodeURIComponent(runId)}?mode=edit`;
}

export function runInstanceRsvpsPath(runId: string, _clubId?: string | null): string {
  return `/runmanage/runs/${encodeURIComponent(runId)}?mode=rsvps`;
}
