"use client";

/**
 * Athlete CityRun creation model — POST /api/cityrun/from-workout (workflow APPROVED).
 * Field patterns aligned with GoFastCompany CreateRunModal (Google Places, pace bands, time).
 * Embed in "Build a Run" pages; keep page-level copy/steps outside this component.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, CheckCircle2, ExternalLink, MapPin } from "lucide-react";
import GooglePlacesAutocomplete from "@/components/RunCrew/GooglePlacesAutocomplete";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";

export type CreateCityRunFormWorkout = {
  id: string;
  title: string;
  workoutType: string;
  description?: string | null;
  date?: string | null;
  estimatedDistanceInMeters?: number | null;
  segments: Array<{
    id: string;
    stepOrder: number;
    title: string;
    durationType: string;
    durationValue: number;
    repeatCount?: number | null;
  }>;
};

export type CityRunFromWorkoutSuccess = {
  cityRunId: string;
  slug: string | null;
  path: string;
  shareUrl: string;
  workoutSlug?: string | null;
  workoutPath?: string | null;
  workoutShareUrl?: string | null;
};

/** Same pace bands as GoFastCompany CreateRunModal (group-run friendly). */
export const CITY_RUN_PACE_OPTIONS = [
  "Various",
  "6:00-6:30",
  "6:30-7:00",
  "7:00-7:30",
  "7:30-8:00",
  "8:00-8:30",
  "8:30-9:00",
  "9:00-9:30",
  "9:30-10:00",
  "10:00-10:30",
  "10:30-11:00",
  "11:00+",
] as const;

function parseCityStateFromFormattedAddress(address: string): { city: string; state: string } {
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const stateZip = parts[parts.length - 2];
    const city = parts[parts.length - 3] || parts[parts.length - 2];
    const state = stateZip.split(/\s+/)[0] || "";
    return { city: city || "", state: state || "" };
  }
  return { city: "", state: "" };
}

export interface CreateCityRunFormProps {
  workout: CreateCityRunFormWorkout;
  onCancel?: () => void;
  /** Called after success when user taps "Done — back to workout". */
  onDone?: () => void;
  className?: string;
  /** Hide the tied-workout card (e.g. if the page shows its own summary). */
  hideWorkoutSummary?: boolean;
}

export default function CreateCityRunForm({
  workout,
  onCancel,
  onDone,
  className = "",
  hideWorkoutSummary = false,
}: CreateCityRunFormProps) {
  const [meetUpLabel, setMeetUpLabel] = useState("");
  const [meetUpStreetAddress, setMeetUpStreetAddress] = useState("");
  const [meetUpPlaceId, setMeetUpPlaceId] = useState<string | null>(null);
  const [meetUpLat, setMeetUpLat] = useState<number | null>(null);
  const [meetUpLng, setMeetUpLng] = useState<number | null>(null);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pace, setPace] = useState<string>(CITY_RUN_PACE_OPTIONS[0]);

  const [runDate, setRunDate] = useState("");
  const [startHour, setStartHour] = useState<string>("");
  const [startMinute, setStartMinute] = useState<string>("");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM" | "">("");
  const [timezone, setTimezone] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CityRunFromWorkoutSuccess | null>(null);
  const [copiedField, setCopiedField] = useState<"rsvp" | "share" | null>(null);

  useEffect(() => {
    const d = workout.date ? new Date(workout.date) : new Date();
    setRunDate(
      !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
  }, [workout.date, workout.id]);

  useEffect(() => {
    const aid = LocalStorageAPI.getAthleteId();
    if (!aid) return;
    (async () => {
      try {
        const { data } = await api.get(`/athlete/${aid}`);
        const a = data?.athlete;
        if (a) {
          setCity((c) => c || a.city || "");
          setState((s) => s || a.state || "");
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const headline = displayWorkoutListTitle({
    title: workout.title,
    workoutType: workout.workoutType,
    estimatedDistanceInMeters: workout.estimatedDistanceInMeters ?? null,
  });

  const handlePlaceSelected = useCallback(
    (placeData: { address: string; name: string; placeId: string; lat: number; lng: number }) => {
      setMeetUpStreetAddress(placeData.address);
      setMeetUpPlaceId(placeData.placeId || null);
      setMeetUpLat(placeData.lat);
      setMeetUpLng(placeData.lng);
      const { city: c, state: st } = parseCityStateFromFormattedAddress(placeData.address);
      if (c) setCity(c);
      if (st) setState(st);
    },
    []
  );

  const handleSubmit = async () => {
    if (!LocalStorageAPI.getAthleteId()) {
      setError("Sign in so we can verify it’s your workout.");
      return;
    }
    if (!meetUpLabel.trim()) {
      setError("Choose a meetup place (search with the location field).");
      return;
    }
    if (!city.trim()) {
      setError("We need a city for listings — pick a place from search or enter city below.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const hourNum =
        startHour === "" ? undefined : Math.min(12, Math.max(1, parseInt(startHour, 10) || 0));
      const minuteNum =
        startMinute === "" ? undefined : Math.min(59, Math.max(0, parseInt(startMinute, 10) || 0));

      const { data } = await api.post<CityRunFromWorkoutSuccess>("/cityrun/from-workout", {
        workoutId: workout.id,
        cityName: city.trim(),
        state: state.trim() || undefined,
        meetUpCity: city.trim(),
        meetUpState: state.trim() || undefined,
        date: runDate,
        meetUpPoint: meetUpLabel.trim(),
        meetUpStreetAddress: meetUpStreetAddress.trim() || undefined,
        meetUpPlaceId: meetUpPlaceId || undefined,
        meetUpLat: meetUpLat ?? undefined,
        meetUpLng: meetUpLng ?? undefined,
        pace: pace && pace !== "Various" ? pace : undefined,
        ...(hourNum != null && hourNum > 0 ? { startTimeHour: hourNum } : {}),
        ...(minuteNum != null ? { startTimeMinute: minuteNum } : {}),
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

  const copyToClipboard = async (text: string, field: "rsvp" | "share") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  if (success) {
    return (
      <div className={`space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${className}`}>
        <p className="text-green-800 font-medium text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          You&apos;re set — copy the links below.
        </p>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            RSVP / CityRun
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
              onClick={() => void copyToClipboard(success.shareUrl, "rsvp")}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {copiedField === "rsvp" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            <Link
              href={success.path.startsWith("/") ? success.path : `/gorun/${success.cityRunId}`}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg"
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </Link>
          </div>
        </div>
        {success.workoutShareUrl ? (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Training share page
            </label>
            <input
              type="text"
              readOnly
              value={success.workoutShareUrl}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => void copyToClipboard(success.workoutShareUrl!, "share")}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {copiedField === "share" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
              <Link
                href={success.workoutPath || `/mytrainingruns/${success.workoutSlug}`}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </Link>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onDone?.()}
          className="block w-full py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Done — back to workout
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {!hideWorkoutSummary ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Tied to this workout
          </p>
          <p className="font-medium text-gray-900">{headline}</p>
          <p className="text-gray-600 text-sm mt-1">Type: {workout.workoutType}</p>
          {workout.description ? (
            <p className="text-gray-600 text-sm mt-2 whitespace-pre-wrap">{workout.description}</p>
          ) : null}
          {workout.segments.length > 0 ? (
            <ul className="mt-3 text-sm text-gray-700 space-y-1 border-t border-gray-100 pt-3">
              {workout.segments.map((s) => (
                <li key={s.id}>
                  <span className="font-medium text-gray-800">{s.title}</span>
                  <span className="text-gray-500">
                    {" "}
                    · {s.durationType === "DISTANCE" ? `${s.durationValue} mi` : `${s.durationValue} min`}
                    {s.repeatCount != null && s.repeatCount > 1 ? ` ×${s.repeatCount}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Meetup location
          </label>
          <GooglePlacesAutocomplete
            value={meetUpLabel}
            onChange={(e) => setMeetUpLabel(e.target.value)}
            onPlaceSelected={handlePlaceSelected}
            placeholder="Search for a corner, track, or address"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Pick a result so we can save map details and city for listings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              City (listing)
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
            Group pace (optional)
          </label>
          <select
            value={pace}
            onChange={(e) => setPace(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {CITY_RUN_PACE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

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
          <div>
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
          <div>
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
          <div>
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
            Timezone (optional)
          </label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
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
            disabled={busy}
            className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create public links"}
          </button>
        </div>
      </div>
    </div>
  );
}
