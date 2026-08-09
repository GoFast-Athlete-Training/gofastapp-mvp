'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Megaphone, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import type { AthleteAnnouncement } from '@/lib/gofast-with-me/container-hub-service';
import { athleteCommunityPath } from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  athleteId: string;
  publicSlug: string;
  embedded?: boolean;
  announcements?: AthleteAnnouncement[];
  hubLoading?: boolean;
  onHubRefresh?: () => Promise<void>;
};

export default function GoFastWithMeFeedPanel({
  athleteId,
  publicSlug,
  embedded = false,
  announcements: announcementsProp,
  hubLoading = false,
  onHubRefresh,
}: Props) {
  const [announcements, setAnnouncements] = useState<AthleteAnnouncement[]>(
    announcementsProp ?? []
  );
  const [loading, setLoading] = useState(!announcementsProp);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);

  const updatesPath = athleteCommunityPath(publicSlug, 'updates');

  const loadAnnouncements = useCallback(async () => {
    if (onHubRefresh) {
      await onHubRefresh();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/announcements`);
      if (res.data?.success && Array.isArray(res.data.announcements)) {
        setAnnouncements(res.data.announcements as AthleteAnnouncement[]);
      } else {
        throw new Error(res.data?.error || 'Could not load announcements');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load announcements');
    } finally {
      setLoading(false);
    }
  }, [athleteId, onHubRefresh]);

  useEffect(() => {
    if (announcementsProp) {
      setAnnouncements(announcementsProp);
      setLoading(false);
    }
  }, [announcementsProp]);

  useEffect(() => {
    if (announcementsProp || onHubRefresh) return;
    void loadAnnouncements();
  }, [announcementsProp, onHubRefresh, loadAnnouncements]);

  const isLoading = loading || hubLoading;

  const handleAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    setPostSuccess(false);
    try {
      await api.post(`/athlete/${athleteId}/announcements`, {
        title: title.trim() || undefined,
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 2500);
      await loadAnnouncements();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not post announcement.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (deletingId) return;
    setDeletingId(announcementId);
    setError(null);
    try {
      await api.delete(`/athlete/${athleteId}/announcements/${announcementId}`);
      await loadAnnouncements();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not delete announcement.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="updates" className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Weekly message</h2>
          <p className="text-sm text-gray-600 mt-1">
            First-class announcements for followers — like Run Club broadcasts, not Chatter.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Weekly message
          </h3>
          <p className="text-xs text-gray-600 mt-1">
            Host announcements — the Journey banner followers see first.
          </p>
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {postSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Weekly message posted to your community.
        </div>
      ) : null}

      <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-2">
          <Megaphone className="h-5 w-5 text-orange-700 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Post this week&apos;s message</h3>
            <p className="text-xs text-gray-600 mt-1">
              Example: &ldquo;Hey guys — new week, let&apos;s crush it. Long run Sunday.&rdquo;
            </p>
          </div>
        </div>
        <form onSubmit={(e) => void handleAnnouncement(e)} className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white"
            placeholder="Optional title (e.g. Week 12)"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white"
            placeholder="Hey guys — new week, let's crush it…"
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post weekly message'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Recent announcements</h3>
            <p className="text-xs text-gray-600 mt-1">
              Latest weekly messages on your public community Journey.
            </p>
          </div>
          {!embedded ? (
            <Link
              href={updatesPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
            >
              View public community
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : announcements.length > 0 ? (
          <ul className="space-y-2">
            {announcements.slice(0, 8).map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm flex gap-3"
              >
                <div className="min-w-0 flex-1">
                  {a.title ? (
                    <p className="font-semibold text-gray-900 mb-1">{a.title}</p>
                  ) : null}
                  <p className="text-gray-800 whitespace-pre-wrap line-clamp-3">{a.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(a.publishedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-red-600 disabled:opacity-50"
                  aria-label="Delete announcement"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No weekly messages yet.</p>
        )}
      </div>
    </section>
  );
}
