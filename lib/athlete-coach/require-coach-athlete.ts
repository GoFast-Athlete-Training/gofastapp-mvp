import { requireAthleteFromBearer } from '@/lib/training/require-athlete';

export async function requireCoachAthleteFromBearer(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) return auth;
  if (!auth.athlete.isCoach) {
    return { error: 'Coach access required', status: 403 as const };
  }
  return auth;
}
