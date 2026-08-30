import type { AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';
import type { AthleteRunRoutePayload } from '@/lib/gofast-with-me/athlete-run-routes';
import type { ActivityPostPayload } from '@/lib/gofast-with-me/activity-posts';
import type { WorkoutStoryPayload } from '@/lib/gofast-with-me/workout-stories';
import type { ContainerHubMessage } from '@/lib/gofast-with-me/container-hub-service';

export type CommunityFeedItemKind = 'dailylog' | 'tip' | 'myrunroute' | 'run' | 'activity' | 'workout';

export type CommunityFeedDailyLogItem = {
  kind: 'dailylog';
  id: string;
  sortAt: string;
  body: string;
  createdAt: string;
};

export type CommunityFeedTipItem = {
  kind: 'tip';
  id: string;
  sortAt: string;
  tip: AthleteTipPayload;
};

export type CommunityFeedMyRunRouteItem = {
  kind: 'myrunroute';
  id: string;
  sortAt: string;
  runRoute: AthleteRunRoutePayload;
};

export type CommunityFeedRunItem = {
  kind: 'run';
  id: string;
  sortAt: string;
  run: {
    id: string;
    title: string;
    date: string;
    meetUpPoint: string;
    gorunPath: string;
  };
};

export type CommunityFeedActivityItem = {
  kind: 'activity';
  id: string;
  sortAt: string;
  post: ActivityPostPayload;
};

export type CommunityFeedWorkoutItem = {
  kind: 'workout';
  id: string;
  sortAt: string;
  story: WorkoutStoryPayload;
};

export type CommunityFeedItem =
  | CommunityFeedDailyLogItem
  | CommunityFeedTipItem
  | CommunityFeedMyRunRouteItem
  | CommunityFeedRunItem
  | CommunityFeedActivityItem
  | CommunityFeedWorkoutItem;

/** @deprecated use CommunityFeedDailyLogItem */
export type CommunityFeedUpdateItem = CommunityFeedDailyLogItem;

export type ComposeCommunityFeedInput = {
  updateMessages: ContainerHubMessage[];
  tips: AthleteTipPayload[];
  runRoutes: AthleteRunRoutePayload[];
  workoutStories?: WorkoutStoryPayload[];
  activityPosts: ActivityPostPayload[];
  upcomingRuns: {
    id: string;
    title: string;
    date: string;
    meetUpPoint: string;
    gorunPath: string;
  }[];
  /** Cap items returned (newest first after sort). */
  limit?: number;
};

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Merge workout stories, daily logs, tips, runs, and legacy activity posts into one reverse-chronological feed. */
export function composeCommunityFeed(input: ComposeCommunityFeedInput): CommunityFeedItem[] {
  const items: CommunityFeedItem[] = [];

  for (const story of input.workoutStories ?? []) {
    const sortAt = story.publishedAt || story.workoutDate || new Date(0).toISOString();
    items.push({
      kind: 'workout',
      id: `workout-${story.id}`,
      sortAt,
      story,
    });
  }

  for (const post of input.activityPosts) {
    const sortAt = post.publishedAt || post.activity.startTime;
    items.push({
      kind: 'activity',
      id: `activity-${post.id}`,
      sortAt,
      post,
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

  for (const tip of input.tips) {
    const sortAt = tip.publishedAt ?? tip.updatedAt ?? tip.createdAt;
    items.push({
      kind: 'tip',
      id: `tip-${tip.id}`,
      sortAt,
      tip,
    });
  }

  for (const runRoute of input.runRoutes) {
    const sortAt = runRoute.publishedAt ?? runRoute.updatedAt ?? runRoute.createdAt;
    items.push({
      kind: 'myrunroute',
      id: `myrunroute-${runRoute.id}`,
      sortAt,
      runRoute,
    });
  }

  const now = Date.now();
  for (const run of input.upcomingRuns) {
    const runTime = new Date(run.date).getTime();
    if (Number.isNaN(runTime) || runTime < now - 24 * 60 * 60 * 1000) continue;
    items.push({
      kind: 'run',
      id: `run-${run.id}`,
      sortAt: run.date,
      run,
    });
  }

  items.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

  const limit = input.limit ?? 50;
  return items.slice(0, limit);
}

export function communityFeedItemLabel(kind: CommunityFeedItemKind): string {
  switch (kind) {
    case 'dailylog':
      return 'Daily log';
    case 'tip':
      return 'Tip';
    case 'myrunroute':
      return 'Route';
    case 'run':
      return 'Run';
    case 'activity':
      return 'Activity';
    case 'workout':
      return 'Workout';
    default:
      return 'Post';
  }
}

export function formatTrainingDistance(miles: number | null): string | null {
  if (miles == null || miles <= 0) return null;
  return `${miles.toFixed(1)} mi`;
}

export { formatDuration as formatTrainingDuration };
