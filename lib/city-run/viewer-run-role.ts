import { RSVP_ROLE_HOST, isHostRsvpRole } from '@/lib/city-run/rsvp-role';

type RunRoleContext = {
  currentRSVPRole?: string | null;
  cityRunType?: string | null;
  athleteGeneratedId?: string | null;
  rsvps?: Array<{ athleteId: string; role?: string | null }>;
};

export function resolveViewerRsvpRole(
  run: RunRoleContext,
  athleteId: string | null | undefined
): string | null {
  if (isHostRsvpRole(run.currentRSVPRole)) return RSVP_ROLE_HOST;

  if (
    athleteId &&
    run.cityRunType === 'INDIVIDUAL' &&
    run.athleteGeneratedId === athleteId
  ) {
    return RSVP_ROLE_HOST;
  }

  if (athleteId && run.rsvps?.length) {
    const mine = run.rsvps.find((r) => r.athleteId === athleteId);
    if (mine?.role) return mine.role;
  }

  return run.currentRSVPRole ?? null;
}
