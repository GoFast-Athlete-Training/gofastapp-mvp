export function runRsvpPath(slugOrId: string): string {
  return `/runrsvp/${encodeURIComponent(slugOrId)}`;
}

export function cityRunTogetherPath(slugOrId: string): string {
  return `/cityruntogether/${encodeURIComponent(slugOrId)}`;
}
