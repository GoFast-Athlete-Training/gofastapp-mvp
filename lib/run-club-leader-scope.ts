/**
 * Run club manager write scope — club managers/admins (athletes) vs internal staff.
 *
 * Authorization source: `run_club_memberships.role` in manager | admin (legacy owner | admin).
 * `Athlete.role = CLUB_LEADER` is onboarding/nav only; it does not grant writes.
 */

import {
  CLUB_MANAGER_WRITE_ROLES,
  isClubManagerAdminRole,
  isClubManagerWriteRole,
  type ClubManagerWriteRole,
} from '@/lib/club-manager-membership-roles';

export const RUN_CLUB_LEADER_ROLES = CLUB_MANAGER_WRITE_ROLES;
export type RunClubLeaderRole = ClubManagerWriteRole;

export { isClubManagerAdminRole, isClubManagerWriteRole };

/** @deprecated Use isClubManagerWriteRole */
export function isRunClubLeaderRole(role: string | null | undefined): role is RunClubLeaderRole {
  return isClubManagerWriteRole(role);
}

/** Fields club managers may update on `run_clubs`. */
export const LEADER_RUN_CLUB_UPDATABLE_FIELDS = [
  'description',
  'allRunsDescription',
  'websiteUrl',
  'instagramUrl',
  'stravaUrl',
  'logoUrl',
] as const;

/** Staff-only / acquisition fields — never writable by club managers. */
export const STAFF_ONLY_RUN_CLUB_FIELDS = [
  'slug',
  'name',
  'city',
  'state',
  'neighborhood',
  'runUrl',
  'citySlug',
  'isMultiSite',
  'brandId',
  'brandSlug',
  'syncedAt',
] as const;

/** Fields managers may update on `run_series`. */
export const LEADER_RUN_SERIES_UPDATABLE_FIELDS = [
  'name',
  'description',
  'runType',
  'totalMiles',
  'routeNeighborhood',
  'workoutDescription',
  'postRunActivity',
  'meetUpPoint',
  'meetUpStreetAddress',
  'meetUpCity',
  'meetUpState',
  'meetUpPlaceId',
  'meetUpLat',
  'meetUpLng',
  'endPoint',
  'endStreetAddress',
  'endCity',
  'endState',
  'startTimeHour',
  'startTimeMinute',
  'startTimePeriod',
  'startDate',
  'endDate',
] as const;

/** Fields managers may update on `city_runs`. */
export const LEADER_CITY_RUN_UPDATABLE_FIELDS = [
  'title',
  'date',
  'dayOfWeek',
  'startTimeHour',
  'startTimeMinute',
  'startTimePeriod',
  'timezone',
  'meetUpPoint',
  'meetUpStreetAddress',
  'meetUpCity',
  'meetUpState',
  'meetUpZip',
  'meetUpPlaceId',
  'meetUpLat',
  'meetUpLng',
  'endPoint',
  'endStreetAddress',
  'endCity',
  'endState',
  'routeNeighborhood',
  'runType',
  'workoutDescription',
  'directionsText',
  'totalMiles',
  'pace',
  'description',
  'postRunActivity',
  'stravaMapUrl',
  'routePhotos',
  'mapImageUrl',
] as const;

/** Staff-only city run fields. */
export const STAFF_ONLY_CITY_RUN_FIELDS = [
  'staffNotes',
  'staffGeneratedId',
  'shakeoutDedupeKey',
  'raceRegistryId',
  'published',
  'stravaEventUrl',
  'stravaText',
  'webUrl',
  'webText',
  'igPostText',
  'igPostGraphic',
] as const;

/** Workflow statuses managers may set (submit for staff review; never APPROVED). */
export const LEADER_ALLOWED_WORKFLOW_STATUSES = ['DEVELOP', 'PENDING', 'SUBMITTED'] as const;

export function pickLeaderFields<T extends Record<string, unknown>>(
  body: T,
  allowed: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}
