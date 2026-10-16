'use client';

import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { SKIP_ATHLETE_BOOTSTRAP_HEADER } from '@/lib/gofast-request-headers';

let bootstrapPromise: Promise<string | null> | null = null;

/**
 * Stamp athleteId into localStorage from GET /api/athlete/me (Bearer only).
 * Required before routes that use requireAthleteFromBearer (x-athlete-id + JWT).
 */
export async function ensureAthleteIdInStorage(): Promise<string | null> {
  const existing = LocalStorageAPI.getAthleteId();
  if (existing) return existing;

  if (!bootstrapPromise) {
    bootstrapPromise = api
      .get('/athlete/me', {
        headers: { [SKIP_ATHLETE_BOOTSTRAP_HEADER]: '1' },
      })
      .then((meRes) => {
        if (meRes.data?.success && meRes.data?.athleteId) {
          const id = String(meRes.data.athleteId);
          LocalStorageAPI.setAthleteId(id);
          return id;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        bootstrapPromise = null;
      });
  }

  return bootstrapPromise;
}
