'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopNav from '@/components/shared/TopNav';
import RunnerAgendaCard from '@/components/runner/RunnerAgendaCard';
import api from '@/lib/api';
import type { RunnerAgendaItem, RunnerAgendaPayload } from '@/lib/runner/runner-agenda';

function RunListSection({
  title,
  items,
  checkingInId,
  onCheckin,
}: {
  title: string;
  items: RunnerAgendaItem[];
  checkingInId: string | null;
  onCheckin: (runId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4" aria-label={title}>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {items.map((item) => (
        <RunnerAgendaCard
          key={item.id}
          item={item}
          checkingInId={checkingInId}
          onCheckin={onCheckin}
        />
      ))}
    </section>
  );
}

export default function RunnerPage() {
  const router = useRouter();
  const [agenda, setAgenda] = useState<RunnerAgendaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/me/runner');
      setAgenda(res.data as RunnerAgendaPayload);
    } catch (err) {
      console.error('Runner load failed:', err);
      setAgenda(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCheckin = async (runId: string) => {
    const item = agenda?.items.find((i) => i.joinedRun?.id === runId);
    const run = item?.joinedRun;
    setCheckingInId(runId);
    try {
      await api.post(`/runs/${runId}/checkin`, {});
      if (run?.runClub?.slug) {
        router.push(`/runclub/${run.runClub.slug}`);
        return;
      }
      await load();
    } catch (err) {
      console.error('Check-in failed:', err);
    } finally {
      setCheckingInId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  const hostedItems = agenda?.hostedItems ?? [];
  const memberItems = agenda?.memberItems ?? [];
  const empty = hostedItems.length === 0 && memberItems.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Runner</h1>
          <p className="mt-1 text-gray-600">Runs you created and runs you&apos;re going to.</p>
        </div>

        {empty ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center space-y-4">
            <div>
              <p className="text-gray-700 font-medium">No runs on your list yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Host a run or join one — it will show up here.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/build-a-run"
                className="inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Host a run
              </Link>
              <Link
                href="/gorun"
                className="inline-flex rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Find a run
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            <RunListSection
              title="Runs I created"
              items={hostedItems}
              checkingInId={checkingInId}
              onCheckin={(runId) => void handleCheckin(runId)}
            />
            <RunListSection
              title="Runs I'm going to"
              items={memberItems}
              checkingInId={checkingInId}
              onCheckin={(runId) => void handleCheckin(runId)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
