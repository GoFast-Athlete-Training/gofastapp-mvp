import { ensureAthleteIdInStorage } from '@/lib/ensure-athlete-session';

/** @deprecated use ensureAthleteIdInStorage */
export async function ensureClubManagerAthleteId(): Promise<string | null> {
  return ensureAthleteIdInStorage();
}
