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
import { companyRunEditorPath } from '@/lib/app-urls';

interface ManageUpcomingRun {
  id: string;
  title: string;
  date: string;
  workflowStatus: string;
  meetUpPoint: string | null;
  rsvps: Array<{ id: string; athlete: { firstName: string | null; lastName: string | null } }>;
}

type SeriesLane = {
  runSeriesId: string;
  seriesLabel: string;
  dayOfWeek: string | null;
  needsAdvance: boolean;
  nextInstanceDate: string | null;
};

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

  const [clubId, setClubId] = useState('');
  const [clubName, setClubName] = useState('');
  const [upcoming, setUpcoming] = useState<ManageUpcomingRun[]>([]);
  const [completed, setCompleted] = useState<CompletedRun[]>([]);
  const [seriesLanes, setSeriesLanes] = useState<SeriesLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [showAddRun, setShowAddRun] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [addRunError, setAddRunError] = useState<string | null>(null);
  const [newRunTitle, setNewRunTitle] = useState('');
  const [newRunDate, setNewRunDate] = useState('');
  const [newRunMeetup, setNewRunMeetup] = useState('');
  const [advancingSeries, setAdvancingSeries] = useState(false);

  const load = useCallback(async () => {
    const [dash, runs, instances] = await Promise.all([
      api.get(`/runclub/${slug}/leader`),
      api.get(`/runclub/${slug}/leader/runs`),
      api.get(`/runclub/${slug}/leader/instances`),
    ]);
    if (dash.data?.club) {
      setClubName(dash.data.club.name);
      if (dash.data.club.id) setClubId(dash.data.club.id);
    }
    if (runs.data?.success) {
      setUpcoming(runs.data.upcoming ?? []);
      setCompleted(runs.data.completed ?? []);
    }
    if (instances.data?.success && Array.isArray(instances.data.lanes)) {
      setSeriesLanes(
        instances.data.lanes.map(
          (lane: {
            runSeriesId: string;
            seriesLabel?: string;
            dayOfWeek?: string | null;
            needsAdvance?: boolean;
            nextInstanceDate?: string | null;
          }) => ({
            runSeriesId: lane.runSeriesId,
            seriesLabel: lane.seriesLabel ?? 'Weekly series',
            dayOfWeek: lane.dayOfWeek ?? null,
            needsAdvance: Boolean(lane.needsAdvance),
            nextInstanceDate: lane.nextInstanceDate ?? null,
          })
        )
      );
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

  const createRun = async () => {
    if (!newRunTitle.trim() || !newRunDate || !newRunMeetup.trim()) {
      setAddRunError('Title, date, and meetup are required.');
      return;
    }
    setCreatingRun(true);
    setAddRunError(null);
    try {
      const res = await api.post(`/runclub/${slug}/leader/runs`, {
        title: newRunTitle.trim(),
        date: new Date(newRunDate).toISOString(),
        meetUpPoint: newRunMeetup.trim(),
      });
      if (!res.data?.success) {
        throw new Error(res.data?.error ?? 'Create failed');
      }
      setNewRunTitle('');
      setNewRunDate('');
      setNewRunMeetup('');
      setShowAddRun(false);
      await load();
    } catch (err: unknown) {
      setAddRunError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreatingRun(false);
    }
  };

  const advanceWeeklySeries = async () => {
    setAdvancingSeries(true);
    try {
      const res = await api.post(`/runclub/${slug}/leader/instances`, {});
      if (!res.data?.success && (res.data?.errorCount ?? 0) > 0) {
        throw new Error('Some series could not be advanced');
      }
      await load();
    } catch {
      setAddRunError('Could not build next weekly instances.');
    } finally {
      setAdvancingSeries(false);
    }
  };

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
            onClick={() => setShowAddRun((v) => !v)}
            className="text-sm font-medium text-sky-700 border border-sky-300 rounded-lg px-4 py-2 hover:bg-sky-50"
          >
            {showAddRun ? 'Cancel' : 'Add run'}
          </button>
        </div>

        {showAddRun ? (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Run title"
              value={newRunTitle}
              onChange={(e) => setNewRunTitle(e.target.value)}
            />
            <input
              type="datetime-local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={newRunDate}
              onChange={(e) => setNewRunDate(e.target.value)}
            />
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Meetup location"
              value={newRunMeetup}
              onChange={(e) => setNewRunMeetup(e.target.value)}
            />
            {addRunError ? <p className="text-xs text-red-600">{addRunError}</p> : null}
            <button
              type="button"
              disabled={creatingRun}
              onClick={() => void createRun()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {creatingRun ? 'Creating…' : 'Create run'}
            </button>
          </div>
        ) : null}

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
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <a
                        href={companyRunEditorPath(run.id, clubId || undefined)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Develop run
                      </a>
                      {!isLive ? (
                        <button
                          type="button"
                          onClick={() => publishUpcomingRun(run.id)}
                          disabled={publishingId === run.id}
                          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                        >
                          {publishingId === run.id ? 'Publishing…' : 'Publish run'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Weekly series</h3>
            <p className="text-sm text-gray-500 mt-1">
              Build the next dated instance from each recurring series lane.
            </p>
          </div>
          <button
            type="button"
            disabled={advancingSeries || seriesLanes.length === 0}
            onClick={() => void advanceWeeklySeries()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {advancingSeries ? 'Building…' : 'Build next week'}
          </button>
        </div>
        {seriesLanes.length === 0 ? (
          <p className="text-sm text-gray-500">No weekly series lanes for this club yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {seriesLanes.map((lane) => (
              <li key={lane.runSeriesId} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{lane.seriesLabel}</p>
                  <p className="text-xs text-gray-500">
                    {lane.dayOfWeek ? `${lane.dayOfWeek} series` : 'Recurring series'}
                    {lane.needsAdvance ? ' · needs next instance' : ''}
                  </p>
                </div>
                {lane.needsAdvance ? (
                  <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Advance
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Up to date</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ClubManagerShell>
  );
}
