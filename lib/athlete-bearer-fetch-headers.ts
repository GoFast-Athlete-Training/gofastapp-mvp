"use client";

import { ATHLETE_ID_HEADER } from "@/lib/gofast-request-headers";
import { LocalStorageAPI } from "@/lib/localstorage";

/**
 * Headers for browser `fetch` to routes that use {@link requireAthleteFromBearer}.
 * Matches {@link api} axios interceptor behavior (Bearer + x-athlete-id).
 */
export function athleteBearerFetchHeaders(bearerToken: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${bearerToken}`,
  };
  const aid = LocalStorageAPI.getAthleteId();
  if (aid) {
    h[ATHLETE_ID_HEADER] = aid;
  }
  return h;
}
