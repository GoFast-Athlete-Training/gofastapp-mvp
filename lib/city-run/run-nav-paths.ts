/** Guest / pre-membership read + RSVP; prefer cityRunTogetherPath for members. */
export function runRsvpPath(slugOrId: string): string {
  return `/runrsvp/${encodeURIComponent(slugOrId)}`;
}

/** Canon athlete run surface (details, RSVP, hub). */
export function cityRunTogetherPath(slugOrId: string): string {
  return `/cityruntogether/${encodeURIComponent(slugOrId)}`;
}

/** Post-run recap — planned workout head + photos / shouts (not the run hub). */
export function runCompletePath(slugOrId: string): string {
  return `/runcomplete/${encodeURIComponent(slugOrId)}`;
}
