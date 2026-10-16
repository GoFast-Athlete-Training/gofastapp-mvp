import { RSVP_ROLE_GOING, isHostRsvpRole, isMemberRsvpRole } from '@/lib/city-run/rsvp-role';

export type RsvpRoleSplitRow = {
  id: string;
  status: string;
  role?: string | null;
  athleteId: string;
  Athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    photoURL?: string | null;
  };
};

/** Literal RSVP decline — row exists but athlete is not on the run. */
export function isDeclinedCityRunRsvp(rsvp: { status: string }): boolean {
  return rsvp.status === 'not-going';
}

/** On the run: host or member (not a can't-make-it row). */
export function isAttendingCityRunRsvp(rsvp: { status: string; role?: string | null }): boolean {
  if (isDeclinedCityRunRsvp(rsvp)) return false;
  if (isHostRsvpRole(rsvp.role)) return true;
  if (rsvp.role === RSVP_ROLE_GOING) return true;
  // Legacy rows before role was set
  return rsvp.status === 'going';
}

export function splitCityRunRsvpsByRole<T extends RsvpRoleSplitRow>(rsvps: T[]): {
  host: T | null;
  members: T[];
} {
  const attending = rsvps.filter(isAttendingCityRunRsvp);
  const host = attending.find((r) => isHostRsvpRole(r.role)) ?? null;
  const members = attending.filter((r) => !isHostRsvpRole(r.role));
  return { host, members };
}

export function attendingCountFromRsvps(rsvps: RsvpRoleSplitRow[]): number {
  return rsvps.filter(isAttendingCityRunRsvp).length;
}

/** Signed-in athlete has an RSVP row on this run (host or member). */
export function isAthleteOnCityRun(run: {
  currentRSVP?: string | null;
  currentRSVPRole?: string | null;
}): boolean {
  if (run.currentRSVP === 'not-going') return false;
  if (isHostRsvpRole(run.currentRSVPRole)) return true;
  if (isMemberRsvpRole(run.currentRSVPRole)) return true;
  return run.currentRSVP === 'going';
}
