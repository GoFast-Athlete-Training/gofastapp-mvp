'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import ClubManagerShell from '@/components/runclub/manager/ClubManagerShell';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

interface ManageRun {
  id: string;
  title: string;
  date: string;
  workflowStatus: string;
  meetUpPoint: string | null;
  rsvps: Array<{ id: string; athlete: { firstName: string | null; lastName: string | null } }>;
}

function runLiveLabel(workflowStatus: string): string {
  return workflowStatus === 'APPROVED' ? 'Live' : 'Not live';
}

export default function ClubManagerRunsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [clubName, setClubName] = useState('');
  const [runs, setRuns] = useState<ManageRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get(`/runclub/${slug}/leader`);
    if (res.data?.success && res.data.club) {
      setClubName(res.data.club.name);
      setRuns(res.data.upcomingRuns ?? []);
    }
  }, [slug]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(
          `/signup?mode=club-manager&redirect=${encodeURIComponent(clubManagerClubPath(slug, 'runs'))}`
        );
        return;
      }
      try {
        await load();
      } catch {
        router.replace(clubManagerHubPath());
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [slug, router, load]);

  const publishRun = async (runId: string) => {
    try {
      setPublishingId(runId);
      await api.patch(`/runclub/${slug}/leader/runs/${runId}`, {
        workflowStatus: 'APPROVED',
      });
      await load();
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <ClubManagerShell clubName={clubName} clubSlug={slug} active="runs">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Runs</h2>
        <p className="text-sm text-gray-500 mt-1">
          Edit weekly series and upcoming instances. Changes go live for members when you publish a
          run.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-sky-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900">Upcoming runs</h3>
          <button
            type="button"
            disabled
            className="text-sm font-medium text-gray-400 border border-dashed border-gray-300 rounded-lg px-4 py-2 cursor-not-allowed"
          >
            Add run (coming soon)
          </button>
        </div>

        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming runs to manage.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {runs.map((run) => {
              const isLive = run.workflowStatus === 'APPROVED';
              return (
                <li key={run.id} className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{run.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(run.date).toLocaleString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                      {run.meetUpPoint && (
                        <p className="text-sm text-gray-500 mt-1">{run.meetUpPoint}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {run.rsvps.length} going · {runLiveLabel(run.workflowStatus)}
                      </p>
                    </div>
                    {!isLive ? (
                      <button
                        type="button"
                        onClick={() => publishRun(run.id)}
                        disabled={publishingId === run.id}
                        className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                      >
                        {publishingId === run.id ? 'Publishing…' : 'Publish'}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900">Weekly series</h3>
          <button
            type="button"
            disabled
            className="text-sm font-medium text-gray-400 border border-dashed border-gray-300 rounded-lg px-4 py-2 cursor-not-allowed"
          >
            Add series (coming soon)
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Series editing will connect here — for now, manage and publish upcoming runs above.
        </p>
      </div>
    </ClubManagerShell>
  );
}
