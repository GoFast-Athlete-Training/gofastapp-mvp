/** Public app URL for gorun / signup links on GoFast Page previews. */
export function getGoFastAppPublicUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GOFAST_APP_URL?.replace(/\/$/, "") ||
    "https://app.gofastcrushgoals.com"
  );
}
