import type { AttendedClubRunPayload } from '@/lib/gofast-with-me/attended-club-runs';
import type { ContainerHubMessage } from '@/lib/gofast-with-me/container-hub-service';
import type { RecentAthleteActivityPayload } from '@/lib/gofast-with-me/recent-athlete-activities';

export type HubStreamFeedItemKind = 'dailylog' | 'activity' | 'attendedRun';

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
  sortAt: string;
  headline: string;
  photoUrl: string | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  startTime: string;
};

export type HubStreamAttendedRunItem = {
  kind: 'attendedRun';
  id: string;
  sortAt: string;
  run: AttendedClubRunPayload;
};

export type HubStreamFeedItem =
  | HubStreamDailyLogItem
  | HubStreamActivityItem
  | HubStreamAttendedRunItem;

function activityHeadline(activity: RecentAthleteActivityPayload): string {
  const publicTitle = activity.matchedWorkout?.publicTitle?.trim();
  if (publicTitle) return publicTitle;
  const planned = activity.matchedWorkout?.title?.trim();
  if (planned) return planned;
  const name = activity.activityName?.trim();
  if (name) return name.replace(/_/g, ' ');
  return 'Run';
}

/** Hub member feed — activities, daily logs, and attended club runs only. */
export function composeHubStreamFeed(input: {
  updateMessages: ContainerHubMessage[];
  recentActivities: RecentAthleteActivityPayload[];
  attendedClubRuns: AttendedClubRunPayload[];
  limit?: number;
}): HubStreamFeedItem[] {
  const items: HubStreamFeedItem[] = [];

  for (const activity of input.recentActivities) {
    if (!activity.startTime) continue;
    items.push({
      kind: 'activity',
      id: `activity-${activity.id}`,
      sortAt: activity.startTime,
      headline: activityHeadline(activity),
      photoUrl: activity.matchedWorkout?.workoutPhotoUrl ?? null,
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

  for (const run of input.attendedClubRuns) {
    items.push({
      kind: 'attendedRun',
      id: `attended-${run.id}`,
      sortAt: run.checkedInAt,
      run,
    });
  }

  items.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
  return items.slice(0, input.limit ?? 50);
}

export function hubStreamFeedItemLabel(kind: HubStreamFeedItemKind): string {
  switch (kind) {
    case 'dailylog':
      return 'Daily log';
    case 'activity':
      return 'Run';
    case 'attendedRun':
      return 'Club run';
    default:
      return 'Post';
  }
}
