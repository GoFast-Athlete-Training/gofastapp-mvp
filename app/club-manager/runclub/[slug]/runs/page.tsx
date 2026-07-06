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

export default function ClubManagerRunsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [clubName, setClubName] = useState('');
  const [runs, setRuns] = useState<ManageRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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

  const submitForReview = async (runId: string) => {
    try {
      setSubmittingId(runId);
      await api.patch(`/runclub/${slug}/leader/runs/${runId}`, {
        workflowStatus: 'SUBMITTED',
      });
      await load();
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <ClubManagerShell clubName={clubName} clubSlug={slug} active="runs">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Runs</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review weekly series and upcoming instances. Submit changes for GoFast staff approval
          before they go live.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
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
            {runs.map((run) => (
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
                      {run.rsvps.length} going · status {run.workflowStatus}
                    </p>
                  </div>
                  {run.workflowStatus !== 'APPROVED' && run.workflowStatus !== 'SUBMITTED' && (
                    <button
                      type="button"
                      onClick={() => submitForReview(run.id)}
                      disabled={submittingId === run.id}
                      className="shrink-0 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      {submittingId === run.id ? 'Submitting…' : 'Submit for review'}
                    </button>
                  )}
                </div>
              </li>
            ))}
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
          Series editing will connect here — for now, review upcoming runs and submit for review
          below.
        </p>
      </div>
    </ClubManagerShell>
  );
}
