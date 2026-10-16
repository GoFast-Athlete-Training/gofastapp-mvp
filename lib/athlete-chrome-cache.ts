'use client';

const CHROME_SNAP_KEY = 'gofast_athlete_chrome_v1';
const PHOTO_CACHE_NAME = 'gofast-athlete-photo-v1';

export type AthleteChromeSnap = {
  athleteId: string;
  firstName: string | null;
  photoURL: string | null;
  cachedAt: number;
};

function photoCacheKey(athleteId: string): string {
  return `photo-${athleteId}`;
}

function normalizePhotoUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  return trimmed || null;
}

/** Sync read of header chrome (name + photo URL). No expiry — stale until refreshed. */
export function readAthleteChrome(athleteId: string | null | undefined): AthleteChromeSnap | null {
  if (typeof window === 'undefined' || !athleteId?.trim()) return null;
  try {
    const raw = localStorage.getItem(CHROME_SNAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AthleteChromeSnap>;
    if (parsed.athleteId !== athleteId) return null;
    return {
      athleteId: parsed.athleteId,
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName : null,
      photoURL: normalizePhotoUrl(parsed.photoURL),
      cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0,
    };
  } catch {
    return null;
  }
}

type RememberInput = {
  id?: string;
  athleteId?: string;
  firstName?: string | null;
  photoURL?: string | null;
};

/** Persist header chrome and warm Cache Storage for the profile image. */
export function rememberAthleteChrome(athlete: RememberInput): void {
  if (typeof window === 'undefined') return;
  const athleteId = (athlete.id ?? athlete.athleteId)?.trim();
  if (!athleteId) return;

  const existing = readAthleteChrome(athleteId);
  const firstName =
    athlete.firstName !== undefined
      ? typeof athlete.firstName === 'string' && athlete.firstName.trim()
        ? athlete.firstName.trim()
        : null
      : (existing?.firstName ?? null);
  const photoURL =
    athlete.photoURL !== undefined
      ? normalizePhotoUrl(athlete.photoURL)
      : (existing?.photoURL ?? null);

  const snap: AthleteChromeSnap = {
    athleteId,
    firstName,
    photoURL,
    cachedAt: Date.now(),
  };

  try {
    localStorage.setItem(CHROME_SNAP_KEY, JSON.stringify(snap));
  } catch {
    // ignore quota errors
  }

  if (photoURL) {
    void prefetchPhotoIntoCache(athleteId, photoURL);
  }
}

async function prefetchPhotoIntoCache(athleteId: string, photoURL: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const res = await fetch(photoURL, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return;
    const blob = await res.blob();
    const cache = await caches.open(PHOTO_CACHE_NAME);
    await cache.put(
      photoCacheKey(athleteId),
      new Response(blob, {
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
      }),
    );
  } catch {
    // CORS or network — localStorage URL still paints via browser HTTP cache
  }
}

/** Prefer cached image bytes; fall back to the stored photo URL. */
export async function resolveChromePhotoSrc(
  athleteId: string,
  photoURL: string | null,
): Promise<string | null> {
  const url = normalizePhotoUrl(photoURL);
  if (!url) return null;
  if (typeof window === 'undefined' || !('caches' in window)) return url;

  try {
    const cache = await caches.open(PHOTO_CACHE_NAME);
    const cached = await cache.match(photoCacheKey(athleteId));
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    return url;
  }

  void prefetchPhotoIntoCache(athleteId, url);
  return url;
}

export async function clearAthleteChrome(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CHROME_SNAP_KEY);
  } catch {
    // ignore
  }
  if ('caches' in window) {
    try {
      await caches.delete(PHOTO_CACHE_NAME);
    } catch {
      // ignore
    }
  }
}

export function chromeSnapToProfileState(
  snap: AthleteChromeSnap | null,
): { firstName?: string; photoURL?: string } | null {
  if (!snap) return null;
  return {
    ...(snap.firstName ? { firstName: snap.firstName } : {}),
    ...(snap.photoURL ? { photoURL: snap.photoURL } : {}),
  };
}
