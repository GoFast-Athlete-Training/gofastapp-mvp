'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type Props = {
  athleteId: string;
  gofastHandle: string | null;
  initialEnabled?: boolean;
  compact?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
};

export default function PersonalCommunityCard({
  athleteId,
  gofastHandle,
  initialEnabled = false,
  compact = false,
  onEnabledChange,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  useEffect(() => {
    if (!athleteId || !enabled) {
      setMemberCount(0);
      return;
    }
    api
      .get(`/athlete/${athleteId}/container/members`)
      .then((r) => setMemberCount(r.data?.count ?? 0))
      .catch(() => {});
  }, [athleteId, enabled]);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/athlete/${athleteId}/container/toggle`, {
        value: !enabled,
      });
      const next = !!res.data?.isGoFastContainer;
      setEnabled(next);
      onEnabledChange?.(next);
      if (next) {
        const m = await api.get(`/athlete/${athleteId}/container/members`);
        setMemberCount(m.data?.count ?? 0);
      } else {
        setMemberCount(0);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.message || e.response?.data?.error || 'Could not update community.');
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass = compact
    ? 'rounded-xl border border-violet-200/80 bg-violet-50/50 p-4'
    : 'rounded-2xl border border-violet-200 bg-violet-50/40 p-5 sm:p-6 shadow-sm';

  return (
    <section className={wrapperClass}>
      <h2 className={`font-bold text-gray-900 ${compact ? 'text-sm' : 'text-lg'}`}>
        Let people join your running community
      </h2>
      <p className={`text-gray-600 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
        A simple member feed for people who want to follow your public runs and chat with you.
      </p>

      {error ? (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      ) : null}

      {enabled ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-violet-900">Community is on</p>
            <p className="text-sm text-gray-600 mt-0.5">
              {memberCount} member{memberCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {gofastHandle ? (
              <Link
                href={`/container/${encodeURIComponent(gofastHandle)}`}
                className="inline-flex items-center rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50"
              >
                Open community
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void handleToggle()}
              disabled={loading}
              className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Turn off'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={loading}
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? 'Turning on…' : 'Turn on community'}
        </button>
      )}
    </section>
  );
}
