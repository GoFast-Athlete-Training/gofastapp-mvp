/**
 * Profile-safe athlete payload for GET /api/athlete/[id] and related routes.
 */

type AthleteRow = Record<string, unknown> & {
  id: string;
  garmin_access_token?: string | null;
};

/** Explicit select for GET /api/athlete/[id] — avoids large Garmin JSON blobs on the hot path. */
export const ATHLETE_PROFILE_SELECT = {
  id: true,
  firebaseId: true,
  email: true,
  companyId: true,
  firstName: true,
  lastName: true,
  gofastHandle: true,
  photoURL: true,
  myBestRunPhotoURL: true,
  phoneNumber: true,
  birthday: true,
  gender: true,
  city: true,
  state: true,
  primarySport: true,
  bio: true,
  instagram: true,
  isGoFastContainer: true,
  garmin_user_id: true,
  garmin_scope: true,
  garmin_connected_at: true,
  garmin_last_sync_at: true,
  garmin_disconnected_at: true,
  garmin_permissions: true,
  garmin_access_token: true,
  fiveKPace: true,
  thresholdPace: true,
  aerobicCeilingBpm: true,
  longRunCapabilityMiles: true,
  longRunCapabilityPaceSecPerMile: true,
  longRunCapabilityDate: true,
  ftpWatts: true,
  weeklyMileage: true,
  role: true,
  runClubId: true,
  createdAt: true,
  updatedAt: true,
  lastSeenAt: true,
  avgWeeklyMilesSnapshot: true,
  mileageSnapshotUpdatedAt: true,
  clubManagerState: true,
} as const;

const PROFILE_ATHLETE_KEYS = [
  'id',
  'firebaseId',
  'email',
  'companyId',
  'firstName',
  'lastName',
  'gofastHandle',
  'photoURL',
  'myBestRunPhotoURL',
  'phoneNumber',
  'birthday',
  'gender',
  'city',
  'state',
  'primarySport',
  'bio',
  'instagram',
  'isGoFastContainer',
  'garmin_user_id',
  'garmin_scope',
  'garmin_connected_at',
  'garmin_last_sync_at',
  'garmin_disconnected_at',
  'garmin_permissions',
  'fiveKPace',
  'thresholdPace',
  'aerobicCeilingBpm',
  'longRunCapabilityMiles',
  'longRunCapabilityPaceSecPerMile',
  'longRunCapabilityDate',
  'ftpWatts',
  'weeklyMileage',
  'role',
  'runClubId',
  'createdAt',
  'updatedAt',
  'lastSeenAt',
  'avgWeeklyMilesSnapshot',
  'mileageSnapshotUpdatedAt',
  'clubManagerState',
] as const;

function pickProfileFields(row: AthleteRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PROFILE_ATHLETE_KEYS) {
    if (key in row) {
      out[key] = row[key];
    }
  }
  return out;
}

export async function buildAthleteForClient(athleteRow: AthleteRow) {
  return {
    ...pickProfileFields(athleteRow),
    garmin_connected: !!(
      athleteRow.garmin_access_token && String(athleteRow.garmin_access_token).length > 0
    ),
  };
}
