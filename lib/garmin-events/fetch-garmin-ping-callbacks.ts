/**
 * Fetch JSON from Garmin PING callbackURLs (Health + Activity).
 */

export async function fetchGarminPingCallbacks(
  items: Array<{ callbackURL?: string }>
): Promise<unknown[]> {
  const allFetched: unknown[] = [];
  for (const item of items) {
    const url = item?.callbackURL;
    if (!url) continue;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        console.warn(`⚠️ Garmin PING fetch failed: ${res.status} ${url.slice(0, 80)}...`);
        continue;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        allFetched.push(...data);
      } else if (data && typeof data === 'object') {
        allFetched.push(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Garmin PING fetch error:', msg, url?.slice(0, 80));
    }
  }
  return allFetched;
}

export function isGarminPingPayload(first: unknown): boolean {
  return (
    first !== null &&
    typeof first === 'object' &&
    'callbackURL' in first &&
    Boolean((first as { callbackURL?: unknown }).callbackURL)
  );
}
