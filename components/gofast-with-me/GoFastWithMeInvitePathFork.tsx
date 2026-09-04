'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  MapPin,
  Users,
  Wrench,
} from 'lucide-react';
import api from '@/lib/api';
import { formatCalendarDate, dateKeyFromIsoOrDateKey, dateKeyToLocalNoonDate } from '@/lib/calendar-date';
import { generateCitySlugFromParts } from '@/lib/parse-google-address';
import { displayWorkoutListTitle } from '@/lib/training/workout-display-title';
import WorkoutStructurePreview from '@/components/training/WorkoutStructurePreview';
import type { CreateCityRunFormWorkout } from '@/components/cityruns/CreateCityRunForm';
import { formatRunTime } from '@/utils/formatTime';
import type { CityRunStampMode } from '@/lib/city-run/city-run-stamp';

export type InviteDiscoveryRun = {
  id: string;
  slug: string | null;
  title: string;
  date: string;
  citySlug: string;
  meetUpPoint: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  runClub: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
  } | null;
  attachedWorkout: { id: string; title: string } | null;
};

type Props = {
  sourceWorkout: CreateCityRunFormWorkout;
  onChooseOwn: () => void;
  onCancel: () => void;
  onDone: () => void;
};

type GroupStep = 'list' | 'choose-workout' | 'success';

const NEARBY_DAY_WINDOW = 3;

function workoutDateKey(date?: string | null): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return dateKeyFromIsoOrDateKey(date) ?? new Date().toISOString().slice(0, 10);
}

function isNearbyRunDate(runDateIso: string, planDateKey: string): boolean {
  const runKey = dateKeyFromIsoOrDateKey(runDateIso);
  if (!runKey || !planDateKey) return true;
  const runMs = dateKeyToLocalNoonDate(runKey).getTime();
  const planMs = dateKeyToLocalNoonDate(planDateKey).getTime();
  const diffDays = Math.abs(runMs - planMs) / (24 * 60 * 60 * 1000);
  return diffDays <= NEARBY_DAY_WINDOW;
}

function formatRunDateLabel(dateIso: string): string {
  const key = dateKeyFromIsoOrDateKey(dateIso);
  if (!key) return dateIso;
  return formatCalendarDate(key, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function GoFastWithMeInvitePathFork({
  sourceWorkout,
  onChooseOwn,
  onCancel,
  onDone,
}: Props) {
  const [path, setPath] = useState<'fork' | 'group'>('fork');
  const [groupStep, setGroupStep] = useState<GroupStep>('list');
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runs, setRuns] = useState<InviteDiscoveryRun[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<InviteDiscoveryRun | null>(null);
  const [stampModeChoice, setStampModeChoice] = useState<CityRunStampMode>('use_city');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [successClubSlug, setSuccessClubSlug] = useState<string | null>(null);

  const planDateKey = useMemo(() => workoutDateKey(sourceWorkout.date), [sourceWorkout.date]);

  const sourceHeadline = displayWorkoutListTitle({
    title: sourceWorkout.title,
    workoutType: sourceWorkout.workoutType,
    estimatedDistanceInMeters: sourceWorkout.estimatedDistanceInMeters ?? null,
  });

  const loadGroupRuns = useCallback(async () => {
    setLoadingRuns(true);
    setLoadError(null);
    try {
      let citySlug: string | undefined;
      try {
        const identityRes = await api.post<{ success?: boolean; identity?: { city?: string | null; state?: string | null } }>(
          '/athlete/identity'
        );
        const identity = identityRes.data?.identity;
        if (identity?.city) {
          citySlug = generateCitySlugFromParts(identity.city, identity.state ?? null) || undefined;
        }
      } catch {
        // Discovery still works without city filter.
      }

      const params: Record<string, string> = {};
      if (citySlug) params.citySlug = citySlug;

      const { data } = await api.get<{ runs?: InviteDiscoveryRun[] }>('/runs/discovery', {
        params,
      });
      const allRuns = (data?.runs ?? []) as InviteDiscoveryRun[];
      const clubRuns = allRuns.filter((r) => r.runClub != null);
      const nearby = clubRuns.filter((r) => isNearbyRunDate(String(r.date), planDateKey));
      setRuns(nearby.length > 0 ? nearby : clubRuns.slice(0, 20));
    } catch {
      setLoadError('Could not load city GoRuns.');
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, [planDateKey]);

  useEffect(() => {
    if (path === 'group' && groupStep === 'list' && runs.length === 0 && !loadingRuns && !loadError) {
      void loadGroupRuns();
    }
  }, [path, groupStep, runs.length, loadingRuns, loadError, loadGroupRuns]);

  const submitRsvp = async (run: InviteDiscoveryRun, stampMode?: CityRunStampMode) => {
    setRsvpBusy(true);
    setRsvpError(null);
    try {
      const body: Record<string, string> = { status: 'going' };
      if (stampMode) {
        body.stampMode = stampMode;
        body.sourceWorkoutId = sourceWorkout.id;
      }
      const { data } = await api.post<{
        success?: boolean;
        runClubSlug?: string | null;
        stamp?: { ok?: boolean; message?: string };
      }>(`/runs/${run.id}/rsvp`, body);
      if (data?.stamp && data.stamp.ok === false) {
        setRsvpError(
          typeof data.stamp.message === 'string'
            ? data.stamp.message
            : 'Could not stamp this run on your plan.'
        );
        return;
      }
      setSuccessClubSlug(data?.runClubSlug ?? run.runClub?.slug ?? null);
      setGroupStep('success');
    } catch {
      setRsvpError('Could not RSVP to this run.');
    } finally {
      setRsvpBusy(false);
    }
  };

  const handleSelectRun = (run: InviteDiscoveryRun) => {
    setSelectedRun(run);
    setRsvpError(null);
    if (run.attachedWorkout?.title) {
      setStampModeChoice('use_city');
      setGroupStep('choose-workout');
    } else {
      void submitRsvp(run);
    }
  };

  if (path === 'fork') {
    return (
      <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">How do you want to invite?</h3>
          <p className="text-xs text-gray-600 mt-1">
            From <span className="font-medium text-gray-900">{sourceHeadline}</span> — join a club
            GoRun or host your own meetup.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPath('group')}
            className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-left hover:border-sky-300 hover:bg-sky-50 transition"
          >
            <Building2 className="h-5 w-5 text-sky-700 mb-2" aria-hidden />
            <span className="block text-sm font-semibold text-gray-900">Choose a GoRun in your city</span>
            <span className="block text-xs text-gray-600 mt-1">
              RSVP to a club run near your plan day. Pick their workout or keep yours when one is
              attached.
            </span>
          </button>

          <button
            type="button"
            onClick={onChooseOwn}
            className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 text-left hover:border-orange-300 hover:bg-orange-50 transition"
          >
            <Wrench className="h-5 w-5 text-orange-700 mb-2" aria-hidden />
            <span className="block text-sm font-semibold text-gray-900">Build your own</span>
            <span className="block text-xs text-gray-600 mt-1">
              Edit your personal workout, then add meetup details and share an RSVP link.
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (groupStep === 'success' && selectedRun) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">You&apos;re going!</h3>
            <p className="text-sm text-gray-700 mt-1">
              RSVP&apos;d to{' '}
              <span className="font-medium">{selectedRun.runClub?.name ?? selectedRun.title}</span>
              {selectedRun.attachedWorkout ? ' — workout stamped on your plan.' : '.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {successClubSlug ? (
            <Link
              href={`/runclub/${successClubSlug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <Users className="h-4 w-4" aria-hidden />
              View club
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (groupStep === 'choose-workout' && selectedRun?.attachedWorkout) {
    const cityTitle = selectedRun.attachedWorkout.title;
    return (
      <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => {
            setGroupStep('list');
            setSelectedRun(null);
            setRsvpError(null);
          }}
          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to runs
        </button>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">Choose your workout</h3>
          <p className="text-xs text-gray-600 mt-1">
            {selectedRun.runClub?.name ?? 'This run'} has a club workout attached. Pick which one
            lands on your plan — you&apos;re not editing the club template.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`rounded-xl border p-4 cursor-pointer transition ${
              stampModeChoice === 'use_city'
                ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-200'
                : 'border-gray-200 hover:border-sky-200'
            }`}
          >
            <input
              type="radio"
              name="stampMode"
              value="use_city"
              checked={stampModeChoice === 'use_city'}
              onChange={() => setStampModeChoice('use_city')}
              className="sr-only"
            />
            <span className="block text-xs font-semibold text-sky-800 uppercase tracking-wide mb-1">
              City workout
            </span>
            <span className="block text-sm font-semibold text-gray-900">{cityTitle}</span>
            <span className="block text-xs text-gray-500 mt-2">Club template for this meetup</span>
          </label>

          <label
            className={`rounded-xl border p-4 cursor-pointer transition ${
              stampModeChoice === 'keep_mine'
                ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-200'
                : 'border-gray-200 hover:border-orange-200'
            }`}
          >
            <input
              type="radio"
              name="stampMode"
              value="keep_mine"
              checked={stampModeChoice === 'keep_mine'}
              onChange={() => setStampModeChoice('keep_mine')}
              className="sr-only"
            />
            <span className="block text-xs font-semibold text-orange-800 uppercase tracking-wide mb-1">
              Your workout
            </span>
            <span className="block text-sm font-semibold text-gray-900">{sourceHeadline}</span>
            {sourceWorkout.segments.length > 0 ? (
              <div className="mt-3 border-t border-gray-100 pt-2">
                <WorkoutStructurePreview
                  segments={sourceWorkout.segments}
                  workoutType={sourceWorkout.workoutType}
                  compact
                />
              </div>
            ) : null}
          </label>
        </div>

        {rsvpError ? <p className="text-sm text-red-600">{rsvpError}</p> : null}

        <button
          type="button"
          disabled={rsvpBusy}
          onClick={() => void submitRsvp(selectedRun, stampModeChoice)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {rsvpBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          RSVP going
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setPath('fork');
            setGroupStep('list');
            setSelectedRun(null);
            setRsvpError(null);
          }}
          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Choose a GoRun in your city</h3>
        <p className="text-xs text-gray-600 mt-1">
          Club runs near your plan day ({formatRunDateLabel(planDateKey)} ± {NEARBY_DAY_WINDOW}{' '}
          days). Select one to RSVP.
        </p>
      </div>

      {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}
      {rsvpError && groupStep === 'list' ? (
        <p className="text-sm text-red-600">{rsvpError}</p>
      ) : null}

      {loadingRuns ? (
        <p className="text-sm text-gray-500 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading city GoRuns…
        </p>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No upcoming club runs found near your plan day. Try{' '}
          <button type="button" onClick={onChooseOwn} className="text-orange-600 font-medium hover:underline">
            Build your own
          </button>{' '}
          instead.
        </div>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {runs.map((run) => {
            const timeLabel = formatRunTime(run);
            const dateLabel = formatRunDateLabel(String(run.date));
            return (
              <li key={run.id}>
                <button
                  type="button"
                  disabled={rsvpBusy}
                  onClick={() => handleSelectRun(run)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left hover:border-sky-300 hover:bg-sky-50/30 disabled:opacity-50 transition"
                >
                  <span className="block text-sm font-semibold text-gray-900">
                    {run.runClub?.name ?? run.title}
                  </span>
                  <span className="block text-xs text-gray-600 mt-0.5">
                    {dateLabel}
                    {timeLabel ? ` · ${timeLabel}` : ''}
                  </span>
                  {run.meetUpPoint ? (
                    <span className="block text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                      {run.meetUpPoint}
                    </span>
                  ) : null}
                  {run.attachedWorkout?.title ? (
                    <span className="inline-flex mt-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                      Workout: {run.attachedWorkout.title}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rsvpBusy && groupStep === 'list' ? (
        <p className="text-sm text-gray-500 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Saving RSVP…
        </p>
      ) : null}
    </div>
  );
}
