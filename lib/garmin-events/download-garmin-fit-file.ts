/**
 * Download a Garmin activity file (FIT) from a temporary callback URL.
 */

import { requireGarminTokenFresh } from "../domain-garmin";
import { refreshGarminToken } from "../garmin-refresh-token";

export async function downloadGarminFitFile(
  athleteId: string,
  downloadUrl: string
): Promise<Uint8Array> {
  let token = await requireGarminTokenFresh(athleteId);
  let res = await fetch(downloadUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    const refreshed = await refreshGarminToken(athleteId);
    if (refreshed.success && refreshed.accessToken?.trim()) {
      token = refreshed.accessToken.trim();
      res = await fetch(downloadUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`FIT download failed: HTTP ${res.status} ${snippet}`);
  }

  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
