/**
 * Profile-safe athlete payload for GET /api/athlete/[id] and related routes.
 */

type AthleteRow = Record<string, unknown> & {
  id: string;
  garmin_access_token?: string | null;
};

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
  'primaryGoalNameSnapshot',
  'primaryGoalTimeSnapshot',
  'primaryGoalTargetByDateSnapshot',
  'primaryGoalRaceNameSnapshot',
  'primaryRaceRegistryIdSnapshot',
  'primaryRaceSlugSnapshot',
  'primaryRaceNameSnapshot',
  'primaryRaceDateSnapshot',
  'primaryRaceDistanceLabelSnapshot',
  'primaryRaceCitySnapshot',
  'primaryRaceStateSnapshot',
  'role',
  'runClubId',
  'createdAt',
  'updatedAt',
  'lastSeenAt',
  'avgWeeklyMilesSnapshot',
  'mileageSnapshotUpdatedAt',
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
