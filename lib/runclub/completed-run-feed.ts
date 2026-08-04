/** Rolling window for club hub completed-run hydrate (MVP1). */
export const COMPLETED_RUN_FEED_DAYS = 14;

export type CompletedRunFeedItem = {
  runId: string;
  runSlug: string | null;
  runTitle: string;
  runDate: string;
  meetUpPoint: string | null;
  postRunNote: string | null;
  postRunPhotoUrl: string | null;
  postRunPublishedAt: string | null;
};

export function completedRunFeedWindowStart(now = new Date()): Date {
  const start = new Date(now);
  start.setDate(start.getDate() - COMPLETED_RUN_FEED_DAYS);
  return start;
}

export function formatCompletedRunFeedItem(run: {
  id: string;
  slug: string | null;
  title: string;
  date: Date;
  meetUpPoint: string;
  postRunNote: string | null;
  postRunPhotoUrl: string | null;
  postRunPublishedAt: Date | null;
}): CompletedRunFeedItem {
  return {
    runId: run.id,
    runSlug: run.slug,
    runTitle: run.title,
    runDate: run.date.toISOString(),
    meetUpPoint: run.meetUpPoint,
    postRunNote: run.postRunNote,
    postRunPhotoUrl: run.postRunPhotoUrl,
    postRunPublishedAt: run.postRunPublishedAt?.toISOString() ?? null,
  };
}
