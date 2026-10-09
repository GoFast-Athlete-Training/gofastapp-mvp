'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import type { ActivityPostOwnerPayload } from '@/lib/gofast-with-me/activity-posts';
import { runnerPublicLandingUrl } from '@/lib/gofast-with-me/runner-public-url';

type Props = {
  publicSlug: string;
};

export default function GoFastWithMeTrainingReflectionsPanel({ publicSlug }: Props) {
  const [reflections, setReflections] = useState<ActivityPostOwnerPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [activityId, setActivityId] = useState('');
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = `${runnerPublicLandingUrl(publicSlug).replace(/\/$/, '')}/reflections`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ reflections: ActivityPostOwnerPayload[] }>(
        '/me/training-reflections'
      );
      setReflections(res.data.reflections ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not load reflections');
      setReflections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/me/training-reflections', {
        caption: caption.trim(),
        activityId: activityId.trim() || null,
        publish,
      });
      setCaption('');
      setActivityId('');
      await load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { error?: string } } };
      setError(ex.response?.data?.error || 'Could not save reflection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Training Reflections</h2>
        <p className="text-sm text-gray-600 mt-1">
          Write here first — optionally attach a synced activity ID. Published reflections show on
          your member feed and public page.
        </p>
        <Link
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex mt-2 text-sm font-semibold text-orange-700 hover:text-orange-800"
        >
          View public reflections →
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
      >
        <h3 className="text-sm font-semibold text-gray-900">New reflection</h3>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          placeholder="What did you learn from this week of training?"
          required
        />
        <div>
          <label htmlFor="reflection-activity-id" className="block text-xs font-medium text-gray-600 mb-1">
            Optional activity ID
          </label>
          <input
            id="reflection-activity-id"
            type="text"
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="Paste activity id from your workout log"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="rounded border-gray-300 text-orange-600"
          />
          Publish to feed and public page
        </label>
        <button
          type="submit"
          disabled={saving || !caption.trim()}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save reflection'}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Your reflections</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : reflections.length === 0 ? (
          <p className="text-sm text-gray-500">No reflections yet.</p>
        ) : (
          <ul className="space-y-3">
            {reflections.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                <p className="text-gray-800 whitespace-pre-wrap">{r.caption}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {r.isPublished ? 'Published' : 'Draft'}
                  {r.activityId ? ` · Activity ${r.activityId.slice(0, 8)}…` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
