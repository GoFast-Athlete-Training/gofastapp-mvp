'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  CONTAINER_TOPICS,
  type ContainerTopic,
  canMemberPostToTopic,
  containerTopicLabel,
} from '@/lib/gofast-with-me/container-topics';
import type {
  ContainerHubMessage,
  ContainerHubPayload,
} from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  hostId: string;
  isHost: boolean;
  canAccessFeed: boolean;
  upcomingRuns?: ContainerHubPayload['upcomingRuns'];
  publishedPlan?: ContainerHubPayload['publishedPlan'];
  initialMessages?: ContainerHubMessage[];
  /** Journey announcements — updates topic only, no topic tabs or plan banner. */
  announcementsMode?: boolean;
  /** Chatter-only community section. */
  chatterMode?: boolean;
  /** RunCrew / Race Hub mobile tab layout — taller chat pane, tighter chrome. */
  variant?: 'default' | 'mobile-hub';
  showHeading?: boolean;
};

type FeedFilter = 'all' | ContainerTopic;

const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  ...CONTAINER_TOPICS.map((t) => ({ id: t as FeedFilter, label: containerTopicLabel(t) })),
];

function authorDisplayName(author: ContainerHubMessage['author']): string {
  const name = [author.firstName, author.lastName].filter(Boolean).join(' ');
  if (name) return name;
  return author.gofastHandle ? `@${author.gofastHandle}` : 'Member';
}

function RunInviteCard({ run }: { run: NonNullable<ContainerHubMessage['cityRun']> }) {
  const href = run.gorunPath.startsWith('/') ? run.gorunPath : `/${run.gorunPath}`;
  return (
    <Link
      href={href}
      className="mt-3 block rounded-lg border border-orange-200 bg-orange-50/80 p-3 hover:border-orange-300 transition"
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800">Join this run</p>
      <p className="text-sm font-semibold text-gray-900 mt-1">{run.title}</p>
      <p className="text-xs text-gray-600 mt-1">
        {new Date(run.date).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
        {run.meetUpPoint ? ` · ${run.meetUpPoint}` : ''}
      </p>
      <span className="mt-2 inline-block text-xs font-semibold text-orange-700">RSVP →</span>
    </Link>
  );
}

export default function GoFastWithMeHubFeed({
  hostId,
  isHost,
  canAccessFeed,
  upcomingRuns = [],
  publishedPlan = null,
  initialMessages = [],
  announcementsMode = false,
  chatterMode = false,
  variant = 'default',
  showHeading = true,
}: Props) {
  const isMobileHub = variant === 'mobile-hub';
  const [filter, setFilter] = useState<FeedFilter>(
    announcementsMode ? 'updates' : chatterMode ? 'chatter' : 'all'
  );
  const [messages, setMessages] = useState<ContainerHubMessage[]>(initialMessages);
  const [composer, setComposer] = useState('');
  const [attachRunId, setAttachRunId] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postTopic: ContainerTopic = announcementsMode
    ? 'updates'
    : chatterMode
      ? 'chatter'
      : filter === 'all'
        ? 'updates'
        : (filter as ContainerTopic);
  const canPostInTopic =
    canAccessFeed &&
    (isHost ||
      ((!announcementsMode && (chatterMode || filter === 'chatter')) &&
        canMemberPostToTopic('chatter')));

  const loadMessages = useCallback(async (activeFilter: FeedFilter) => {
    setLoading(true);
    setError(null);
    try {
      const topicQuery =
        activeFilter === 'all' ? '' : `&topic=${encodeURIComponent(activeFilter)}`;
      const res = await api.get(
        `/athlete/${hostId}/container/messages?limit=40${topicQuery}`
      );
      if (res.data?.messages) {
        setMessages(res.data.messages);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not load feed.');
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    if (chatterMode) {
      void loadMessages('chatter');
      return;
    }
    void loadMessages(filter);
  }, [filter, loadMessages, chatterMode]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composer.trim() || posting || !canPostInTopic) return;
    setPosting(true);
    setError(null);
    try {
      await api.post(`/athlete/${hostId}/container/messages`, {
        body: composer.trim(),
        topic: postTopic,
        ...(isHost && attachRunId ? { cityRunId: attachRunId } : {}),
      });
      setComposer('');
      setAttachRunId('');
      await loadMessages(chatterMode ? 'chatter' : filter);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not post.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!isHost || !confirm('Delete this post?')) return;
    try {
      await api.delete(`/athlete/${hostId}/container/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setError('Could not delete post.');
    }
  };

  const sectionTitle = announcementsMode ? 'Daily log' : chatterMode ? 'Chatter' : 'Feed';

  if (!canAccessFeed && !chatterMode && !announcementsMode) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{sectionTitle}</h2>
        <p className="mt-2 text-sm text-gray-600">
          Follow to read daily logs from this GoFast athlete.
        </p>
      </section>
    );
  }

  const listClassName = isMobileHub
    ? 'min-h-[min(18rem,42dvh)] max-h-[min(32rem,calc(100dvh-18rem))] flex-1'
    : 'max-h-96';

  return (
    <section
      id={announcementsMode ? 'updates' : chatterMode ? 'chatter' : 'feed'}
      className={
        isMobileHub
          ? 'flex min-h-0 flex-1 flex-col space-y-3 min-w-0'
          : 'space-y-4'
      }
    >
      {!announcementsMode && !isMobileHub && publishedPlan ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-4 py-3 text-xs text-violet-900">
          Training plan shared in this hub —{' '}
          <Link
            href={`/plans/${encodeURIComponent(publishedPlan.slug)}`}
            className="font-semibold text-violet-800 hover:underline"
          >
            {publishedPlan.name}
          </Link>
        </div>
      ) : null}

      <div
        className={
          isMobileHub
            ? 'flex min-h-0 flex-1 flex-col space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm'
            : 'rounded-2xl border border-gray-200 bg-white p-5 space-y-4'
        }
      >
        {showHeading && !announcementsMode && !chatterMode ? (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{sectionTitle}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {isHost
                ? 'Share what you are doing, thinking, and invite followers to join your runs.'
                : 'Updates from the host and community chatter.'}
            </p>
          </div>
        ) : null}
        {showHeading && chatterMode ? (
          <div className={isMobileHub ? 'px-0.5' : undefined}>
            <h2 className={isMobileHub ? 'text-xl font-bold text-gray-900 mb-1' : 'text-sm font-semibold text-gray-900 uppercase tracking-wide'}>
              {sectionTitle}
            </h2>
            <p className={isMobileHub ? 'text-sm text-gray-500' : 'text-xs text-gray-500 mt-1'}>
              {isHost
                ? 'Follower conversation — review and moderate from studio.'
                : canAccessFeed
                  ? 'Join the conversation with other followers.'
                  : 'Follow to post in Chatter.'}
            </p>
          </div>
        ) : null}

        {!announcementsMode && !chatterMode ? (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {FEED_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div
          className={`overflow-y-auto space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3 ${listClassName}`}
        >
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              {announcementsMode
                ? 'No daily logs yet.'
                : filter === 'all'
                  ? 'No posts yet.'
                  : `No ${FEED_FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} yet.`}
            </p>
          ) : (
            messages.map((m) => (
              <article key={m.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900">{authorDisplayName(m.author)}</span>
                    {filter === 'all' ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {containerTopicLabel(m.topic as ContainerTopic)}
                      </span>
                    ) : null}
                  </div>
                  {isHost ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(m.id)}
                      className="text-xs text-red-600 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="text-gray-700 mt-1 whitespace-pre-wrap">{m.body}</p>
                {m.cityRun ? <RunInviteCard run={m.cityRun} /> : null}
                {m.route ? (
                  <p className="text-xs text-violet-700 mt-2 font-medium">
                    Route: {m.route.name}
                    {m.route.distanceMiles != null ? ` · ${m.route.distanceMiles} mi` : ''}
                    {m.route.citySlug ? ` · ${m.route.citySlug}` : ''}
                  </p>
                ) : null}
                <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
              </article>
            ))
          )}
        </div>

        {canPostInTopic ? (
          <form onSubmit={(e) => void handlePost(e)} className="space-y-2 shrink-0">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              rows={isMobileHub ? 2 : 3}
              maxLength={2000}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm"
              placeholder={
                isHost
                  ? announcementsMode
                    ? 'How are you feeling today?'
                    : 'Share an update — e.g. running 10 miles Saturday morning, join me…'
                  : 'Say something to the group…'
              }
            />
            {isHost && !announcementsMode && upcomingRuns.length > 0 ? (
              <div className="space-y-1">
                <label htmlFor="attach-run" className="text-xs font-semibold text-gray-700">
                  Attach a joinable run (optional)
                </label>
                <select
                  id="attach-run"
                  value={attachRunId}
                  onChange={(e) => setAttachRunId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">No run attached</option>
                  {upcomingRuns.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} — {new Date(r.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            ) : isHost && !announcementsMode ? (
              <p className="text-xs text-gray-500">
                Host a run from GoRun to attach run invites to legacy feed posts.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={posting || !composer.trim()}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {posting
                ? 'Posting…'
                : isHost
                  ? announcementsMode
                    ? 'Post daily log'
                    : `Post to ${filter === 'all' ? 'Updates' : containerTopicLabel(postTopic)}`
                  : 'Post to Chatter'}
            </button>
          </form>
        ) : announcementsMode ? (
          <p className="text-xs text-gray-500">Only the host posts daily logs.</p>
        ) : chatterMode && !canAccessFeed ? (
          <p className="text-xs text-gray-500">Follow to post in Chatter.</p>
        ) : (
          <p className="text-xs text-gray-500">
            Only the host can post updates. Switch to Chatter to join the conversation.
          </p>
        )}
      </div>
    </section>
  );
}
