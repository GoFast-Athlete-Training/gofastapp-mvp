'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Route } from 'lucide-react';
import api from '@/lib/api';
import {
  buildShareCreatorCards,
  type ShareHubStatus,
} from '@/lib/profile/share-creator-card-logic';
import ShareCreatorCard from '@/components/profile/ShareCreatorCard';

export default function GoFastWithMeSetupPanel() {
  const [status, setStatus] = useState<ShareHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/me/share-hub-status');
        if (!cancelled && res.data?.status) {
          setStatus(res.data.status as ShareHubStatus);
        }
      } catch {
        if (!cancelled) setError('Could not load configure status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = status ? buildShareCreatorCards(status) : [];
  const planCard = cards.find((c) => c.id === 'plan');
  const runCard = cards.find((c) => c.id === 'run');

  return (
    <section id="configure" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Configure</h2>
        <p className="text-sm text-gray-600 mt-1">
          Connect training plans and runs — they hydrate your public page and member hub automatically.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading configure status…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {planCard ? (
            <ShareCreatorCard
              card={planCard}
              icon={Calendar}
              accentClass="bg-violet-100 text-violet-700"
            />
          ) : null}
          {runCard ? (
            <ShareCreatorCard card={runCard} icon={Route} accentClass="bg-sky-100 text-sky-700" />
          ) : null}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Quick links</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/training-setup"
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
          >
            Connect training plan
          </Link>
          <Link
            href="/training/lead"
            className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50"
          >
            Publish training plan
          </Link>
          <Link
            href="/build-a-run"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            Build a run
          </Link>
          <Link
            href="/host-a-run"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            Host a public run
          </Link>
        </div>
      </div>
    </section>
  );
}
