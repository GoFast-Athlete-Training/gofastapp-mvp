/** Stable key for dedupe: origin + pathname + search, no trailing slash on path (except root). */
export function normalizeCauseWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    u.hash = "";
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `${u.protocol}//${host}${path}${u.search}`;
  } catch {
    return null;
  }
}
