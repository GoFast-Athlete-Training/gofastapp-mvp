import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * Ensure athleteId is in localStorage (club door and /club-manager entry).
 * Returns athleteId or null if bootstrap failed.
 */
export async function ensureClubManagerAthleteId(): Promise<string | null> {
  const existing = LocalStorageAPI.getAthleteId();
  if (existing) return existing;

  try {
    const meRes = await api.get('/athlete/me');
    if (meRes.data?.success && meRes.data?.athleteId) {
      const id = String(meRes.data.athleteId);
      LocalStorageAPI.setAthleteId(id);
      return id;
    }
  } catch {
    // caller handles redirect
  }
  return null;
}
