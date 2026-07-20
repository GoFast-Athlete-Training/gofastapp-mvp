'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, Route } from 'lucide-react';
import api from '@/lib/api';
import {
  buildShareCreatorCards,
  type ShareHubStatus,
} from '@/lib/profile/share-creator-card-logic';
import ShareCreatorCard from '@/components/profile/ShareCreatorCard';

type Props = {
  liveUrl: string;
  isPublishReady: boolean;
};

export default function GoFastWithMeSetupPanel({ liveUrl, isPublishReady }: Props) {
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
        if (!cancelled) setError('Could not load setup status.');
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
    <section id="setup" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Setup</h2>
        <p className="text-sm text-gray-600 mt-1">
          Connect training plans and runs — they hydrate your public page and member hub automatically.
        </p>
      </div>

      <article className="rounded-2xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Public page readiness</h3>
            <p className="text-xs text-gray-600 mt-1">
              {isPublishReady
                ? 'Landing copy is ready — share your public URL.'
                : 'Add welcome + bio in General content before sharing widely.'}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isPublishReady
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {isPublishReady ? 'Ready' : 'Draft'}
          </span>
        </div>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Open public page
          <ExternalLink className="h-4 w-4" />
        </a>
      </article>

      {loading ? (
        <p className="text-sm text-gray-500">Loading setup status…</p>
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
