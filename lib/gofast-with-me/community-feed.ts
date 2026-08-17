import type { AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';
import type { ContainerHubMessage } from '@/lib/gofast-with-me/container-hub-service';

export type CommunityFeedItemKind = 'dailylog' | 'tip' | 'run' | 'training';

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

export type CommunityFeedTrainingItem = {
  kind: 'training';
  id: string;
  sortAt: string;
  activity: {
    activityName: string | null;
    startTime: string;
    distanceMiles: number | null;
    durationSeconds: number | null;
    activityType: string | null;
    source: string | null;
  };
};

export type CommunityFeedItem =
  | CommunityFeedDailyLogItem
  | CommunityFeedTipItem
  | CommunityFeedRunItem
  | CommunityFeedTrainingItem;

/** @deprecated use CommunityFeedDailyLogItem */
export type CommunityFeedUpdateItem = CommunityFeedDailyLogItem;

export type CommunityLastActivity = CommunityFeedTrainingItem['activity'];

export type ComposeCommunityFeedInput = {
  updateMessages: ContainerHubMessage[];
  tips: AthleteTipPayload[];
  upcomingRuns: {
    id: string;
    title: string;
    date: string;
    meetUpPoint: string;
    gorunPath: string;
  }[];
  lastActivity?: CommunityLastActivity | null;
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

/** Merge daily logs, tips, training, and runs into one reverse-chronological feed. */
export function composeCommunityFeed(input: ComposeCommunityFeedInput): CommunityFeedItem[] {
  const items: CommunityFeedItem[] = [];

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

  if (input.lastActivity?.startTime) {
    items.push({
      kind: 'training',
      id: 'training-latest',
      sortAt: input.lastActivity.startTime,
      activity: input.lastActivity,
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
    case 'run':
      return 'Run';
    case 'training':
      return 'Latest training';
    default:
      return 'Post';
  }
}

export function formatTrainingDistance(miles: number | null): string | null {
  if (miles == null || miles <= 0) return null;
  return `${miles.toFixed(1)} mi`;
}

export { formatDuration as formatTrainingDuration };
