"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Users, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";

export type InviteModalWorkout = {
  id: string;
  title: string;
  workoutType: string;
  description?: string | null;
  date?: string | null;
  estimatedDistanceInMeters?: number | null;
};

type InviteSuccess = {
  cityRunId: string;
  slug: string | null;
  path: string;
  shareUrl: string;
};

interface InviteCityRunFromWorkoutModalProps {
  open: boolean;
  onClose: () => void;
  workout: InviteModalWorkout | null;
}

export default function InviteCityRunFromWorkoutModal({
  open,
  onClose,
  workout,
}: InviteCityRunFromWorkoutModalProps) {
  const [runDate, setRunDate] = useState("");
  const [meetUpPoint, setMeetUpPoint] = useState(
    "Meetup details TBD — add corner, track, or address"
  );
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [startHour, setStartHour] = useState<string>("");
  const [startMinute, setStartMinute] = useState<string>("");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM" | "">("");
  const [timezone, setTimezone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<InviteSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !workout) return;
    const d = workout.date ? new Date(workout.date) : new Date();
    setRunDate(
      !Number.isNaN(d.getTime())
        ? d.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setError(null);
    setSuccess(null);
    setCopied(false);
    const aid = LocalStorageAPI.getAthleteId();
    if (!aid) return;
    (async () => {
      try {
        const { data } = await api.get(`/athlete/${aid}`);
        const a = data?.athlete;
        if (a) {
          setCity(a.city || "");
          setState(a.state || "");
        }
      } catch {
        /* ignore */
      }
    })();
  }, [open, workout]);

  const handleSubmit = async () => {
    if (!workout) return;
    if (!LocalStorageAPI.getAthleteId()) {
      setError("Sign in so we can verify it’s your workout.");
      return;
    }
    if (!city.trim()) {
      setError("City is required so the run appears in city listings.");
      return;
    }
    if (!meetUpPoint.trim()) {
      setError("Where you meet (meet-up description) is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const hourNum =
        startHour === "" ? undefined : Math.min(12, Math.max(1, parseInt(startHour, 10) || 0));
      const minuteNum =
        startMinute === ""
          ? undefined
          : Math.min(59, Math.max(0, parseInt(startMinute, 10) || 0));

      const { data } = await api.post<InviteSuccess>("/cityrun/from-workout", {
        workoutId: workout.id,
        cityName: city.trim(),
        state: state.trim() || undefined,
        meetUpCity: city.trim(),
        meetUpState: state.trim() || undefined,
        date: runDate,
        meetUpPoint: meetUpPoint.trim(),
        ...(hourNum != null && hourNum > 0
          ? { startTimeHour: hourNum }
          : {}),
        ...(minuteNum != null
          ? { startTimeMinute: minuteNum }
          : {}),
        ...(startPeriod ? { startTimePeriod: startPeriod } : {}),
        ...(timezone.trim() ? { timezone: timezone.trim() } : {}),
      });
      if (data?.cityRunId && data?.path) {
        setSuccess(data);
      } else {
        setError("Unexpected response from server.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || "Could not create CityRun.");
    } finally {
      setBusy(false);
    }
  };

  const copyShareUrl = async () => {
    if (!success?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(success.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!open || !workout) return null;

  const headline = displayWorkoutListTitle({
    title: workout.title,
    workoutType: workout.workoutType,
    estimatedDistanceInMeters: workout.estimatedDistanceInMeters ?? null,
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-cityrun-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-5 h-5 text-sky-600 shrink-0" />
            <h2
              id="invite-cityrun-title"
              className="text-lg font-semibold text-gray-900 truncate"
            >
              Invite others to this workout
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Creates a <span className="font-medium">CityRun</span> linked to this workout. Add when
          and where you&apos;re meeting; workout type and structure stay tied to your plan.
        </p>

        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 mb-4 text-sm">
          <p className="font-medium text-gray-900">{headline}</p>
          <p className="text-gray-600 mt-0.5">Type: {workout.workoutType}</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <p className="text-green-800 font-medium text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Your public link is ready — share it so friends can RSVP.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Link to copy
              </label>
              <input
                type="text"
                readOnly
                value={success.shareUrl}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => void copyShareUrl()}
                className="inline-flex items-center justify-center gap-2 flex-1 py-2 text-sm font-semibold text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
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
              <Link
                href={success.path.startsWith("/") ? success.path : `/gorun/${success.cityRunId}`}
                className="inline-flex items-center justify-center gap-2 flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg"
              >
                <ExternalLink className="w-4 h-4" />
                Open run page
              </Link>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="block w-full py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Run date
              </label>
              <input
                type="date"
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Start time
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
                  aria-label="Hour"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Minute
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={startMinute}
                  onChange={(e) => setStartMinute(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
                  aria-label="Minute"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  &nbsp;
                </label>
                <select
                  value={startPeriod}
                  onChange={(e) => setStartPeriod(e.target.value as "AM" | "PM" | "")}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
                  aria-label="AM or PM"
                >
                  <option value="">—</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Where we meet
              </label>
              <textarea
                value={meetUpPoint}
                onChange={(e) => setMeetUpPoint(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Timezone (optional)
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              City and state set listing location (same rules as other city runs). Prefilled from
              your profile when possible.
            </p>
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={busy}
                className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create invite link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
