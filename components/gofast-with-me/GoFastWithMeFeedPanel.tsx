'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Megaphone } from 'lucide-react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  athleteId: string;
  publicSlug: string;
};

export default function GoFastWithMeFeedPanel({ athleteId, publicSlug }: Props) {
  const [hub, setHub] = useState<ContainerHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

  const hubPath = `/container/${encodeURIComponent(publicSlug)}#messages`;

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/container/hub`);
      if (res.data?.success && res.data.hub) {
        setHub(res.data.hub as ContainerHubPayload);
      } else {
        throw new Error(res.data?.error || 'Could not load hub');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load hub');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  const handleAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim() || posting) return;
    setPosting(true);
    setError(null);
    setPostSuccess(false);
    try {
      await api.post(`/athlete/${athleteId}/container/messages`, {
        body: announcement.trim(),
        topic: 'updates',
      });
      setAnnouncement('');
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 2500);
      await loadHub();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not post announcement.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section id="messages" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Messages</h2>
        <p className="text-sm text-gray-600 mt-1">
          Journey announcements for your followers — race updates, plan milestones, what&apos;s next.
          Posts appear in your GoFast With Me hub.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {postSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Announcement posted to your hub.
        </div>
      ) : null}

      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-2">
          <Megaphone className="h-5 w-5 text-violet-700 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Post an announcement</h3>
            <p className="text-xs text-gray-600 mt-1">
              Example: &ldquo;Week 12 of MCM prep — long run Sunday, following the plan strip.&rdquo;
            </p>
          </div>
        </div>
        <form onSubmit={(e) => void handleAnnouncement(e)} className="space-y-2">
          <textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white"
            placeholder="Share a journey update with your followers…"
          />
          <button
            type="submit"
            disabled={posting || !announcement.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post announcement'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Recent announcements</h3>
            <p className="text-xs text-gray-600 mt-1">
              Latest messages visible to followers in the member hub.
            </p>
          </div>
          <Link
            href={hubPath}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
          >
            View as member
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : hub && hub.messages.length > 0 ? (
          <ul className="space-y-2">
            {hub.messages.slice(0, 5).map((m) => (
              <li key={m.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <p className="text-gray-800 whitespace-pre-wrap line-clamp-3">{m.body}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No announcements yet.</p>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
        What I&apos;m thinking about (tips and voice) is planned separately via athlete-owned CMS
        content. Today, journey messages use container announcements.
      </div>
    </section>
  );
}
