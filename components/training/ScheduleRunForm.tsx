"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  Route,
} from "lucide-react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import {
  buildStartTimeLabel,
  computeEstimatedFinishLabel,
  metersToMilesNumber,
} from "@/lib/training/schedule-run-estimated-finish";
import type { ScheduledRunJson } from "@/app/api/training/schedule-run/route";

function tomorrowDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ScheduleRunFormProps = {
  initialDate?: string;
  initialWorkoutId?: string;
  onCancel?: () => void;
  onDone?: () => void;
  className?: string;
};

export default function ScheduleRunForm({
  initialDate,
  initialWorkoutId,
  onCancel,
  onDone,
  className = "",
}: ScheduleRunFormProps) {
  const [runDate, setRunDate] = useState(initialDate || tomorrowDateKey());
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("AM");
  const [title, setTitle] = useState("");
  const [estimatedDistanceMi, setEstimatedDistanceMi] = useState("");
  const [isTrack, setIsTrack] = useState(false);
  const [stravaRouteUrl, setStravaRouteUrl] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [routeDescription, setRouteDescription] = useState("");
  const [inviteFriend, setInviteFriend] = useState(false);

  const [fiveKPace, setFiveKPace] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(initialWorkoutId || null);
  const [loadingWorkout, setLoadingWorkout] = useState(Boolean(initialWorkoutId));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ScheduledRunJson | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialDate) setRunDate(initialDate);
  }, [initialDate]);

  const loadWorkout = useCallback(async () => {
    if (!initialWorkoutId) {
      setLoadingWorkout(false);
      return;
    }
    setLoadingWorkout(true);
    setLoadError(null);
    try {
      const { data } = await api.get<{
        workout: {
          id: string;
          title: string;
          workoutType: string;
          date?: string | null;
          estimatedDistanceInMeters?: number | null;
          training_plans?: { currentFiveKPace?: string | null } | null;
        };
      }>(`/training/workout/${initialWorkoutId}`);
      const w = data?.workout;
      if (!w) {
        setLoadError("Workout not found");
        return;
      }
      setWorkoutId(w.id);
      setTitle(
        displayWorkoutListTitle({
          title: w.title,
          workoutType: w.workoutType,
          estimatedDistanceInMeters: w.estimatedDistanceInMeters ?? null,
        })
      );
      const mi = metersToMilesNumber(w.estimatedDistanceInMeters ?? null);
      if (mi != null) setEstimatedDistanceMi(String(Math.round(mi * 100) / 100));
      if (w.date) {
        const d = new Date(w.date);
        if (!Number.isNaN(d.getTime())) {
          setRunDate(d.toISOString().slice(0, 10));
        }
      }
      const pace =
        w.training_plans?.currentFiveKPace?.trim() || null;
      setFiveKPace(pace);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setLoadError(err.response?.data?.error || "Could not load workout");
    } finally {
      setLoadingWorkout(false);
    }
  }, [initialWorkoutId]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  const startTimeLabel = useMemo(() => {
    const hourNum = startHour === "" ? null : parseInt(startHour, 10);
    const minuteNum = startMinute === "" ? 0 : parseInt(startMinute, 10);
    if (hourNum == null || hourNum < 1 || hourNum > 12) return null;
    if (!Number.isFinite(minuteNum) || minuteNum < 0 || minuteNum > 59) return null;
    return buildStartTimeLabel(hourNum, minuteNum, startPeriod);
  }, [startHour, startMinute, startPeriod]);

  const estimatedFinishLabel = useMemo(() => {
    const mi =
      estimatedDistanceMi.trim() === ""
        ? null
        : parseFloat(estimatedDistanceMi);
    return computeEstimatedFinishLabel({
      startTimeLabel,
      estimatedDistanceMi: mi != null && Number.isFinite(mi) ? mi : null,
      fiveKPace,
    });
  }, [startTimeLabel, estimatedDistanceMi, fiveKPace]);

  const handleSubmit = async () => {
    if (!LocalStorageAPI.getAthleteId()) {
      setError("Sign in to schedule a run.");
      return;
    }
    const effectiveTitle = title.trim();
    if (!effectiveTitle) {
      setError("What are you doing? Add a short description.");
      return;
    }
    if (!runDate.trim()) {
      setError("Pick a date.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const hourNum = startHour === "" ? undefined : parseInt(startHour, 10);
      const minuteNum = startMinute === "" ? undefined : parseInt(startMinute, 10);
      const mi =
        estimatedDistanceMi.trim() === ""
          ? undefined
          : parseFloat(estimatedDistanceMi);

      const { data } = await api.post<{ scheduledRun: ScheduledRunJson }>(
        "/training/schedule-run",
        {
          date: runDate,
          title: effectiveTitle,
          workoutId: workoutId || undefined,
          estimatedDistanceMi: mi != null && Number.isFinite(mi) ? mi : undefined,
          isTrack,
          stravaRouteUrl: stravaRouteUrl.trim() || undefined,
          meetupLocation: meetupLocation.trim() || undefined,
          routeDescription: routeDescription.trim() || undefined,
          inviteFriend,
          ...(hourNum != null && hourNum >= 1 && hourNum <= 12
            ? {
                startTimeHour: hourNum,
                startTimeMinute: minuteNum ?? 0,
                startTimePeriod: startPeriod,
              }
            : startTimeLabel
              ? { startTimeLabel }
              : {}),
        }
      );
      if (data?.scheduledRun) {
        setSuccess(data.scheduledRun);
      } else {
        setError("Unexpected response from server.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || "Could not schedule run.");
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async () => {
    if (!success?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(success.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (loadingWorkout) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-8 text-center ${className}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`rounded-xl border border-red-100 bg-red-50 p-5 ${className}`}>
        <p className="text-red-800 text-sm">{loadError}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className={`space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${className}`}>
        <p className="text-green-800 font-medium text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Run scheduled
          {success.startTimeLabel ? ` · ${success.startTimeLabel}` : ""}
        </p>
        <p className="text-gray-900 font-semibold">{success.title}</p>
        {success.shareUrl ? (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Share with a friend
            </label>
            <input
              type="text"
              readOnly
              value={success.shareUrl}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => void copyShare()}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy link
                  </>
                )}
              </button>
              {success.joinPath ? (
                <Link
                  href={success.joinPath}
                  className="flex-1 inline-flex items-center justify-center py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
                >
                  Preview
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onDone?.()}
          className="block w-full py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${className}`}>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-orange-500" />
          When
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Start time
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={1}
                max={12}
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                placeholder="6"
                className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                aria-label="Hour"
              />
              <span className="text-gray-400">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={startMinute}
                onChange={(e) => setStartMinute(e.target.value)}
                placeholder="30"
                className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                aria-label="Minute"
              />
              <select
                value={startPeriod}
                onChange={(e) => setStartPeriod(e.target.value as "AM" | "PM")}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-[5rem]"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </div>
        {estimatedFinishLabel ? (
          <p className="mt-2 text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
            Estimated finish ~{estimatedFinishLabel}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          What are you doing?
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="5 miles easy"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="mt-2">
          <label className="block text-xs text-gray-600 mb-1">Distance (miles, optional)</label>
          <input
            type="number"
            step="0.1"
            min={0}
            value={estimatedDistanceMi}
            onChange={(e) => setEstimatedDistanceMi(e.target.value)}
            placeholder="5"
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <label className="mt-3 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isTrack}
            onChange={(e) => setIsTrack(e.target.checked)}
            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm text-gray-800">On a track</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-2">
          <Route className="w-4 h-4 text-orange-500" />
          Strava route <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="url"
          value={stravaRouteUrl}
          onChange={(e) => setStravaRouteUrl(e.target.value)}
          placeholder="https://www.strava.com/routes/…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          Meetup <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={meetupLocation}
          onChange={(e) => setMeetupLocation(e.target.value)}
          placeholder="Corner of George Mason and Columbia Pike"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Route description <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={routeDescription}
          onChange={(e) => setRouteDescription(e.target.value)}
          rows={2}
          placeholder="Down George Mason and through the woods"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer border-t border-gray-100 pt-4">
        <input
          type="checkbox"
          checked={inviteFriend}
          onChange={(e) => setInviteFriend(e.target.checked)}
          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-sm font-medium text-gray-900">Invite a friend — get a share link</span>
      </label>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy || !title.trim()}
          className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50"
        >
          {busy ? "Saving…" : "Schedule this run"}
        </button>
      </div>
    </div>
  );
}
