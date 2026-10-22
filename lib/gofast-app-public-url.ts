/** Canonical prod athlete app (gofastapp-mvp). Not app.gofastcrushgoals.com (legacy). */
export function getGoFastAppPublicUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GOFAST_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://pr.gofastcrushgoals.com"
  );
}
