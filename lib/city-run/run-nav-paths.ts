export function runRsvpPath(slugOrId: string): string {
  return `/runrsvp/${encodeURIComponent(slugOrId)}`;
}

export function cityRunTogetherPath(slugOrId: string): string {
  return `/cityruntogether/${encodeURIComponent(slugOrId)}`;
}

/** Post-run recap — planned workout head + photos / shouts (not the RSVP hub). */
export function runCompletePath(slugOrId: string): string {
  return `/runcomplete/${encodeURIComponent(slugOrId)}`;
}
