/** Alias — redirects to cityRunTogetherPath. */
export function runRsvpPath(slugOrId: string): string {
  return cityRunTogetherPath(slugOrId);
}

/** Member run hub (details, people, chatter) after RSVP. */
export function cityRunTogetherPath(slugOrId: string): string {
  return `/cityruntogether/${encodeURIComponent(slugOrId)}`;
}

export function cityRunRsvpSuccessQuery(): string {
  return "rsvp=success";
}

/** Post-run recap — planned workout head + photos / shouts (not the run hub). */
export function runCompletePath(slugOrId: string): string {
  return `/runcomplete/${encodeURIComponent(slugOrId)}`;
}
