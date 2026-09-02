"use client";

/**
 * Athlete CityRun from workout — workout context (read-only) + meetup + time + optional route.
 * POST /api/cityrun/from-workout.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarClock,
  Copy,
  CheckCircle2,
  ExternalLink,
  MapPin,
  ChevronDown,
  ChevronRight,
  Route,
} from "lucide-react";
import GooglePlacesAutocomplete, {
  type GooglePlaceSelectedData,
} from "@/components/RunCrew/GooglePlacesAutocomplete";
import WorkoutStructurePreview from "@/components/training/WorkoutStructurePreview";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import type { WorkoutPreviewSegment } from "@/lib/training/workout-segment-preview";
import {
  parseGoogleAddressFromComponents,
  generateCitySlugFromParts,
} from "@/lib/parse-google-address";
import { formatCalendarDate } from "@/lib/calendar-date";

export type CreateCityRunFormWorkout = {
  id: string;
  title: string;
  workoutType: string;
  description?: string | null;
  date?: string | null;
  estimatedDistanceInMeters?: number | null;
  segments: WorkoutPreviewSegment[];
  city_runs?: Array<{ id: string; date: string | null; createdAt: string }>;
};

export type CityRunFromWorkoutSuccess = {
  cityRunId: string;
  slug: string | null;
  path: string;
  shareUrl: string;
  joinSignupUrl?: string | null;
  workoutSlug?: string | null;
  workoutPath?: string | null;
  workoutShareUrl?: string | null;
};

const METERS_PER_MILE = 1609.34;

function formatPlannedMiles(meters: number | null | undefined): string | null {
  if (meters == null || meters <= 0 || !Number.isFinite(meters)) return null;
  const mi = meters / METERS_PER_MILE;
  const rounded = Math.round(mi * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} mi planned`;
}

function formatDateLabel(isoDate: string): string {
  if (!isoDate.trim()) return "";
  return formatCalendarDate(isoDate, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMeetupConfirmation(city: string, state: string): string {
  const c = city.trim();
  const s = state.trim().toUpperCase();
  if (!c) return "";
  if (s === "DC" || c.toLowerCase() === "dc") return `${c} · DC`;
  if (s) return `${c}, ${s}`;
  return c;
}

function workoutDateKey(date?: string | null): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  const d = new Date(date);
  return !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function hasValidStartTime(hour: string, minute: string, period: "AM" | "PM"): boolean {
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  return (
    hour.trim() !== "" &&
    minute.trim() !== "" &&
    Number.isFinite(h) &&
    h >= 1 &&
    h <= 12 &&
    Number.isFinite(m) &&
    m >= 0 &&
    m <= 59 &&
    (period === "AM" || period === "PM")
  );
}

export interface CreateCityRunFormProps {
  workout: CreateCityRunFormWorkout;
  onCancel?: () => void;
  onDone?: () => void;
  className?: string;
  hideWorkoutSummary?: boolean;
}

export default function CreateCityRunForm({
  workout,
  onCancel,
  onDone,
  className = "",
  hideWorkoutSummary = false,
}: CreateCityRunFormProps) {
  const [meetupDate, setMeetupDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("AM");

  const [meetUpPoint, setMeetUpPoint] = useState("");
  const [meetUpStreetAddress, setMeetUpStreetAddress] = useState("");
  const [meetUpCity, setMeetUpCity] = useState("");
  const [meetUpState, setMeetUpState] = useState("");
  const [meetUpZip, setMeetUpZip] = useState("");
  const [meetUpPlaceId, setMeetUpPlaceId] = useState<string | null>(null);
  const [meetUpLat, setMeetUpLat] = useState<number | null>(null);
  const [meetUpLng, setMeetUpLng] = useState<number | null>(null);
  const [meetUpPlaceSet, setMeetUpPlaceSet] = useState(false);

  const [meetUpNote, setMeetUpNote] = useState("");
  const [workoutNarrative, setWorkoutNarrative] = useState("");
  const [stravaMapUrl, setStravaMapUrl] = useState("");

  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CityRunFromWorkoutSuccess | null>(null);
  const [copiedField, setCopiedField] = useState<"rsvp" | "share" | "join" | null>(null);

  useEffect(() => {
    setMeetupDate(workoutDateKey(workout.date));
  }, [workout.date, workout.id]);

  const headline = displayWorkoutListTitle({
    title: workout.title,
    workoutType: workout.workoutType,
    estimatedDistanceInMeters: workout.estimatedDistanceInMeters ?? null,
  });

  const handleStartPlaceSelected = useCallback((placeData: GooglePlaceSelectedData) => {
    const parsed = parseGoogleAddressFromComponents(
      placeData.address,
      placeData.addressComponents
    );
    setMeetUpPoint(placeData.name || placeData.address);
    setMeetUpStreetAddress(parsed.streetAddress || placeData.address);
    setMeetUpCity(parsed.city || "");
    setMeetUpState(parsed.state || "");
    setMeetUpZip(parsed.zip || "");
    setMeetUpPlaceId(placeData.placeId || null);
    setMeetUpLat(placeData.lat);
    setMeetUpLng(placeData.lng);
    setMeetUpPlaceSet(true);
  }, []);

  const meetupConfirmation =
    meetUpPlaceSet && meetUpCity.trim()
      ? formatMeetupConfirmation(meetUpCity, meetUpState)
      : null;

  const canSubmit =
    Boolean(meetupDate.trim()) &&
    Boolean(meetUpPoint.trim()) &&
    Boolean(meetUpCity.trim()) &&
    meetUpPlaceSet &&
    hasValidStartTime(startHour, startMinute, startPeriod);

  const handleSubmit = async () => {
    if (!LocalStorageAPI.getAthleteId()) {
      setError("Sign in so we can verify it’s your workout.");
      return;
    }
    if (!meetUpPoint.trim() || !meetUpPlaceSet) {
      setError("Choose a meetup spot from the search results.");
      return;
    }
    if (!meetUpCity.trim()) {
      setError("We need a city from your meetup pick — select a Places result.");
      return;
    }
    if (!meetupDate.trim()) {
      setError("Pick a meetup date for the invite.");
      return;
    }
    if (!hasValidStartTime(startHour, startMinute, startPeriod)) {
      setError("Add a start time so people know when to meet you.");
      return;
    }

    const citySlug = generateCitySlugFromParts(meetUpCity, meetUpState);
    if (!citySlug) {
      setError("We need a valid city for listings.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const hourNum = Math.min(12, Math.max(1, parseInt(startHour, 10)));
      const minuteNum = Math.min(59, Math.max(0, parseInt(startMinute, 10) || 0));

      const { data } = await api.post<CityRunFromWorkoutSuccess>("/cityrun/from-workout", {
        workoutId: workout.id,
        citySlug,
        cityName: meetUpCity.trim(),
        state: meetUpState.trim() || undefined,
        date: meetupDate,
        meetUpPoint: meetUpPoint.trim(),
        meetUpStreetAddress: meetUpStreetAddress.trim() || meetUpPoint.trim(),
        meetUpCity: meetUpCity.trim(),
        meetUpState: meetUpState.trim() || undefined,
        meetUpZip: meetUpZip.trim() || undefined,
        meetUpPlaceId: meetUpPlaceId || undefined,
        meetUpLat: meetUpLat ?? undefined,
        meetUpLng: meetUpLng ?? undefined,
        meetUpNote: meetUpNote.trim() || undefined,
        workoutNarrative: workoutNarrative.trim() || undefined,
        stravaMapUrl: stravaMapUrl.trim() || undefined,
        startTimeHour: hourNum,
        startTimeMinute: minuteNum,
        startTimePeriod: startPeriod,
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

  const copyToClipboard = async (text: string, field: "rsvp" | "share" | "join") => {
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
          You&apos;re hosting — share the invite link so others can sign up and RSVP.
        </p>
        {success.joinSignupUrl ? (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Invite link (signup + RSVP)
            </label>
            <input
              type="text"
              readOnly
              value={success.joinSignupUrl}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => void copyToClipboard(success.joinSignupUrl!, "join")}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg"
              >
                {copiedField === "join" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy invite link
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Run hub (for people already on GoFast)
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

  const plannedMilesLabel = formatPlannedMiles(workout.estimatedDistanceInMeters ?? null);
  const existingRuns = workout.city_runs ?? [];
  const planDateLabel = formatDateLabel(workoutDateKey(workout.date));

  const workoutPanel = !hideWorkoutSummary ? (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-fit lg:sticky lg:top-6">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-sky-600" />
        From your workout
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
          {workout.workoutType}
        </span>
        {plannedMilesLabel ? (
          <span className="text-xs text-gray-600">{plannedMilesLabel}</span>
        ) : null}
      </div>
      {planDateLabel ? (
        <p className="text-sm text-gray-700 mb-2 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-gray-400 shrink-0" />
          <span>
            On your plan · <span className="font-medium text-gray-900">{planDateLabel}</span>
          </span>
        </p>
      ) : null}
      <p className="font-medium text-gray-900 text-base">{headline}</p>
      {workout.segments.length > 0 ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Workout structure
          </p>
          <WorkoutStructurePreview
            segments={workout.segments}
            workoutType={workout.workoutType}
            compact
          />
        </div>
      ) : null}
    </div>
  ) : null;

  const primaryForm = (
    <div className="space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-2">
          <Route className="w-4 h-4 text-orange-500" />
          You add
        </p>
        <p className="text-xs text-gray-500">
          Pick a meetup and a start time. A route is optional.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          Where to meet
        </label>
        <GooglePlacesAutocomplete
          value={meetUpPoint}
          onChange={(e) => {
            setMeetUpPoint(e.target.value);
            setMeetUpPlaceSet(false);
          }}
          onPlaceSelected={handleStartPlaceSelected}
          placeholder="Search for a location…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {meetupConfirmation ? (
          <p className="text-sm text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {meetUpPoint.trim()}
            {meetupConfirmation ? ` · ${meetupConfirmation}` : null}
          </p>
        ) : (
          <p className="text-xs text-gray-500">Pick a result so we can list city and address correctly.</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
          <CalendarClock className="w-3.5 h-3.5" />
          Meetup date
        </label>
        <input
          type="date"
          value={meetupDate}
          onChange={(e) => setMeetupDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Defaults to your plan day — change if you&apos;re meeting on a different date.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Start time
        </label>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="number"
            min={1}
            max={12}
            value={startHour}
            onChange={(e) => setStartHour(e.target.value)}
            className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
            aria-label="Hour"
            placeholder="6"
          />
          <span className="text-gray-400">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={startMinute}
            onChange={(e) => setStartMinute(e.target.value)}
            className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
            aria-label="Minute"
            placeholder="00"
          />
          <select
            value={startPeriod}
            onChange={(e) => setStartPeriod(e.target.value as "AM" | "PM")}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-[5rem]"
            aria-label="AM or PM"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Route <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="url"
          value={stravaMapUrl}
          onChange={(e) => setStravaMapUrl(e.target.value)}
          placeholder="https://www.strava.com/routes/…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">Skip if you&apos;re looping the meetup.</p>
      </div>

      <div className="border-t border-gray-100 pt-2">
        <button
          type="button"
          onClick={() => setMoreDetailsOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-medium text-sky-800 hover:text-sky-950 w-full text-left py-1"
          aria-expanded={moreDetailsOpen}
        >
          {moreDetailsOpen ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          More details
        </button>

        {moreDetailsOpen ? (
          <div className="mt-4 space-y-4 pl-0 sm:pl-1">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Meetup note <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={meetUpNote}
                onChange={(e) => setMeetUpNote(e.target.value)}
                rows={2}
                placeholder="E.g., We usually meet at the back of the parking lot."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Workout narrative <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={workoutNarrative}
                onChange={(e) => setWorkoutNarrative(e.target.value)}
                rows={2}
                placeholder="E.g., Hey — this tempo is gonna be hard."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-gray-100">
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
          disabled={busy || !canSubmit}
          className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Creating…" : "Create invite"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {existingRuns.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 mb-6 text-sm text-amber-950">
          <p className="font-medium text-amber-900">
            {existingRuns.length === 1
              ? "You already have a public run linked to this workout."
              : `You already have ${existingRuns.length} public runs linked to this workout.`}
          </p>
          <p className="text-amber-800/90 mt-1 text-xs">
            You can open an existing invite below or create another meetup.
          </p>
          <ul className="mt-2 space-y-1">
            {existingRuns.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/gorun/${r.id}`}
                  className="inline-flex items-center gap-1 text-amber-900 font-medium underline underline-offset-2 hover:text-amber-950"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Open CityRun
                  {r.date
                    ? ` · ${formatCalendarDate(r.date, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {workoutPanel ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {workoutPanel}
          {primaryForm}
        </div>
      ) : (
        primaryForm
      )}
    </div>
  );
}
