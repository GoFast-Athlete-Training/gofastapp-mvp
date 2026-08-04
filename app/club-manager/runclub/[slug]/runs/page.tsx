'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { Camera, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import ClubManagerShell from '@/components/runclub/manager/ClubManagerShell';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';
import type { CompletedRunFeedItem } from '@/lib/runclub/completed-run-feed';

interface ManageUpcomingRun {
  id: string;
  title: string;
  date: string;
  workflowStatus: string;
  meetUpPoint: string | null;
  rsvps: Array<{ id: string; athlete: { firstName: string | null; lastName: string | null } }>;
}

type CompletedRun = CompletedRunFeedItem & {
  workflowStatus: string;
  postRunPublished: boolean;
};

function runLiveLabel(workflowStatus: string): string {
  return workflowStatus === 'APPROVED' ? 'Live' : 'Not live';
}

function CompletedRunEditor({
  run,
  slug,
  onSaved,
}: {
  run: CompletedRun;
  slug: string;
  onSaved: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(run.postRunNote ?? '');
  const [photoUrl, setPhotoUrl] = useState(run.postRunPhotoUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/runclub/${slug}/leader/runs/${run.runId}`, {
        postRunNote: note.trim() || null,
        postRunPhotoUrl: photoUrl.trim() || null,
        postRunPublished: false,
      });
      onSaved();
    } catch {
      setError('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/runclub/${slug}/leader/runs/${run.runId}`, {
        postRunNote: note.trim() || null,
        postRunPhotoUrl: photoUrl.trim() || null,
        postRunPublished: true,
      });
      onSaved();
    } catch {
      setError('Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      setPhotoUrl(data.url as string);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <li className="py-5 border-b border-gray-100 last:border-0">
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-semibold text-gray-900">{run.runTitle}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(run.runDate).toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          {run.postRunPublished ? (
            <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Published on hub
            </span>
          ) : (
            <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              Add photo & note
            </span>
          )}
        </div>

        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-sky-200 bg-sky-50">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sky-400">
                <Camera className="h-6 w-6" aria-hidden />
              </div>
            )}
            {photoUrl ? (
              <button
                type="button"
                onClick={() => setPhotoUrl('')}
                disabled={uploading || saving}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 disabled:opacity-50"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || saving}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload group photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploading || saving}
            />
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="How did the run go? Turnout, vibe, what’s next…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          disabled={saving}
        />

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={saving || uploading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={saving || uploading || (!note.trim() && !photoUrl.trim())}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? 'Publishing…' : run.postRunPublished ? 'Update publish' : 'Publish'}
          </button>
        </div>
      </div>
    </li>
  );
}

export default function ClubManagerRunsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [clubName, setClubName] = useState('');
  const [upcoming, setUpcoming] = useState<ManageUpcomingRun[]>([]);
  const [completed, setCompleted] = useState<CompletedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dash, runs] = await Promise.all([
      api.get(`/runclub/${slug}/leader`),
      api.get(`/runclub/${slug}/leader/runs`),
    ]);
    if (dash.data?.club) setClubName(dash.data.club.name);
    if (runs.data?.success) {
      setUpcoming(runs.data.upcoming ?? []);
      setCompleted(runs.data.completed ?? []);
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

  const publishUpcomingRun = async (runId: string) => {
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

  const needsPostRun = completed.filter((r) => !r.postRunPublished);

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
          Publish upcoming runs for members, then add a group photo and note after each completed
          run.
        </p>
      </div>

      {needsPostRun.length > 0 ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">{needsPostRun.length} completed run(s)</span> waiting for
          a post-run photo or note — publish to show on the member hub.
        </div>
      ) : null}

      <div className="bg-white rounded-xl border border-sky-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Completed runs — post-run recap</h3>
        {completed.length === 0 ? (
          <p className="text-sm text-gray-500">No completed runs in the last two weeks.</p>
        ) : (
          <ul>
            {completed.map((run) => (
              <CompletedRunEditor key={run.runId} run={run} slug={slug} onSaved={load} />
            ))}
          </ul>
        )}
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

        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming runs to manage.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map((run) => {
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
                        onClick={() => publishUpcomingRun(run.id)}
                        disabled={publishingId === run.id}
                        className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                      >
                        {publishingId === run.id ? 'Publishing…' : 'Publish run'}
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
        <h3 className="font-semibold text-gray-900 mb-2">Weekly series</h3>
        <p className="text-sm text-gray-500">Series editing will connect here.</p>
      </div>
    </ClubManagerShell>
  );
}
