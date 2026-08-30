import type { ActivityPostPayload } from '@/lib/gofast-with-me/activity-posts';
import type { RecentAthleteActivityPayload } from '@/lib/gofast-with-me/recent-athlete-activities';

export type RunningSectionActivityRow = {
  kind: 'activity';
  id: string;
  activity: RecentAthleteActivityPayload;
  post: ActivityPostPayload | null;
};

export type RunningSectionItem = RunningSectionActivityRow;

export function mapActivityPostsByActivityId(
  activityPosts: ActivityPostPayload[]
): Map<string, ActivityPostPayload> {
  const map = new Map<string, ActivityPostPayload>();
  for (const post of activityPosts) {
    map.set(post.activityId, post);
  }
  return map;
}

/** MVP1: runs-only swipe rail — recent running activities enriched with optional posts. */
export function buildRunningSectionItems(input: {
  recentActivities: RecentAthleteActivityPayload[];
  activityPosts: ActivityPostPayload[];
}): RunningSectionItem[] {
  const postByActivityId = mapActivityPostsByActivityId(input.activityPosts);

  return input.recentActivities.map((activity) => ({
    kind: 'activity' as const,
    id: activity.id,
    activity,
    post: postByActivityId.get(activity.id) ?? null,
  }));
}
