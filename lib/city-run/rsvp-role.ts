/** Junction role on city_run_rsvps — host vs going (not the same as status). */
export const RSVP_ROLE_HOST = 'host' as const;
export const RSVP_ROLE_GOING = 'going' as const;

export type CityRunRsvpRole = typeof RSVP_ROLE_HOST | typeof RSVP_ROLE_GOING;

export function isHostRsvpRole(role: string | null | undefined): boolean {
  return role === RSVP_ROLE_HOST;
}

export function isGoingRsvpRole(role: string | null | undefined): boolean {
  return role === RSVP_ROLE_GOING || role == null;
}
