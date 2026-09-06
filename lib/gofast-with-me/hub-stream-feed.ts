import type { AttendedClubRunPayload } from '@/lib/gofast-with-me/attended-club-runs';
import type { ContainerHubMessage } from '@/lib/gofast-with-me/container-hub-service';
import type { RecentAthleteActivityPayload } from '@/lib/gofast-with-me/recent-athlete-activities';

export type HubStreamFeedItemKind = 'dailylog' | 'activity';

export type HubStreamDailyLogItem = {
  kind: 'dailylog';
  id: string;
  sortAt: string;
  body: string;
  createdAt: string;
};

export type HubStreamActivityItem = {
  kind: 'activity';
  id: string;
  activityId: string;
  sortAt: string;
  headline: string;
  photoUrl: string | null;
  reflection: string | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  startTime: string;
};

export type HubStreamFeedItem = HubStreamDailyLogItem | HubStreamActivityItem;

const PLANNED_DISTANCE_SUFFIX = /\s*[-–—]\s*\d+(\.\d+)?\s*(mi|mile|miles)\b.*$/i;

function stripPlannedDistanceSuffix(title: string): string {
  return title.replace(PLANNED_DISTANCE_SUFFIX, '').trim();
}

function activityHeadline(activity: RecentAthleteActivityPayload): string {
  const hasActualMiles = activity.distanceMiles != null && activity.distanceMiles > 0;
  const publicTitle = activity.matchedWorkout?.publicTitle?.trim();
  if (publicTitle) {
    return hasActualMiles ? stripPlannedDistanceSuffix(publicTitle) : publicTitle;
  }
  const planned = activity.matchedWorkout?.title?.trim();
  if (planned) {
    return hasActualMiles ? stripPlannedDistanceSuffix(planned) : planned;
  }
  const name = activity.activityName?.trim();
  if (name) return name.replace(/_/g, ' ');
  return 'Run';
}

/** Hub recent stream — Garmin activities + daily logs only (no city_run_checkins). */
export function composeHubStreamFeed(input: {
  updateMessages: ContainerHubMessage[];
  recentActivities: RecentAthleteActivityPayload[];
  /** @deprecated ignored — RSVP/check-ins do not belong in Recent */
  attendedClubRuns?: AttendedClubRunPayload[];
  limit?: number;
}): HubStreamFeedItem[] {
  const items: HubStreamFeedItem[] = [];

  for (const activity of input.recentActivities) {
    if (!activity.startTime) continue;
    items.push({
      kind: 'activity',
      id: `activity-${activity.id}`,
      activityId: activity.id,
      sortAt: activity.startTime,
      headline: activityHeadline(activity),
      photoUrl: activity.matchedWorkout?.workoutPhotoUrl ?? null,
      reflection: activity.matchedWorkout?.reflection?.trim() || null,
      distanceMiles: activity.distanceMiles,
      durationSeconds: activity.durationSeconds,
      startTime: activity.startTime,
    });
  }

  for (const message of input.updateMessages) {
    items.push({
      kind: 'dailylog',
      id: `dailylog-${message.id}`,
      sortAt: message.createdAt,
      body: message.body,
      createdAt: message.createdAt,
    });
  }

  items.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
  return items.slice(0, input.limit ?? 50);
}

export function hubStreamFeedItemLabel(kind: HubStreamFeedItemKind): string {
  switch (kind) {
    case 'dailylog':
      return 'Journal';
    case 'activity':
      return 'Workout';
    default:
      return 'Post';
  }
}
