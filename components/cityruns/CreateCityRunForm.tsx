"use client";

/**
 * Athlete CityRun from workout — workout context (read-only) + meetup + time + optional route.
 * POST /api/cityrun/from-workout.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  applyPaceOffsetDeltaToSegments,
  metersToMiles,
  milesToMeters,
  PACE_OFFSET_PRESETS,
  presetForPaceOffset,
  scaleSegmentDistances,
  segmentsToPrescribePayload,
  type InvitePaceEase,
} from "@/lib/gofast-with-me/invite-workout-edit";

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

function normalizeWorkoutSegments(
  segments: WorkoutPreviewSegment[] | null | undefined
): WorkoutPreviewSegment[] {
  return Array.isArray(segments) ? segments : [];
}

function normalizeWorkoutForForm(
  workout: CreateCityRunFormWorkout
): CreateCityRunFormWorkout {
  return {
    ...workout,
    segments: normalizeWorkoutSegments(workout.segments),
  };
}

export interface CreateCityRunFormProps {
  workout: CreateCityRunFormWorkout;
  onCancel?: () => void;
  onDone?: () => void;
  className?: string;
  hideWorkoutSummary?: boolean;
  /** Build-your-own invite path — athlete can edit personal prescribe before creating meetup. */
  editableWorkout?: boolean;
  onWorkoutChange?: (workout: CreateCityRunFormWorkout) => void;
}

export default function CreateCityRunForm({
  workout,
  onCancel,
  onDone,
  className = "",
  hideWorkoutSummary = false,
  editableWorkout = false,
  onWorkoutChange,
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
  const [routeNeighborhood, setRouteNeighborhood] = useState("");
  const [mapImageUrl, setMapImageUrl] = useState("");

  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CityRunFromWorkoutSuccess | null>(null);
  const [copiedField, setCopiedField] = useState<"rsvp" | "share" | "join" | null>(null);

  const [editTitle, setEditTitle] = useState(workout.title);
  const [editMiles, setEditMiles] = useState(
    () => metersToMiles(workout.estimatedDistanceInMeters ?? null)?.toString() ?? ""
  );
  const [paceOffsetSecPerMile, setPaceOffsetSecPerMile] = useState(0);
  const [workoutSaving, setWorkoutSaving] = useState(false);
  const [workoutSaveError, setWorkoutSaveError] = useState<string | null>(null);
  const [previewWorkout, setPreviewWorkout] = useState(() => normalizeWorkoutForForm(workout));
  const baselineSegmentsRef = useRef(normalizeWorkoutSegments(workout.segments));
  const baselineMetersRef = useRef(workout.estimatedDistanceInMeters ?? milesToMeters(4));
  const lastPersistedRef = useRef({
    title: workout.title,
    miles: metersToMiles(workout.estimatedDistanceInMeters ?? null)?.toString() ?? "",
    paceOffset: 0,
  });

  useEffect(() => {
    const normalized = normalizeWorkoutForForm(workout);
    setEditTitle(normalized.title);
    setEditMiles(metersToMiles(normalized.estimatedDistanceInMeters ?? null)?.toString() ?? "");
    setPaceOffsetSecPerMile(0);
    setPreviewWorkout(normalized);
    baselineSegmentsRef.current = normalized.segments;
    baselineMetersRef.current = normalized.estimatedDistanceInMeters ?? milesToMeters(4);
    lastPersistedRef.current = {
      title: normalized.title,
      miles: metersToMiles(normalized.estimatedDistanceInMeters ?? null)?.toString() ?? "",
      paceOffset: 0,
    };
  }, [workout.id]);

  useEffect(() => {
    setMeetupDate(workoutDateKey(workout.date));
  }, [workout.date, workout.id]);

  const headline = displayWorkoutListTitle({
    title: editableWorkout ? previewWorkout.title : workout.title,
    workoutType: workout.workoutType,
    estimatedDistanceInMeters: editableWorkout
      ? previewWorkout.estimatedDistanceInMeters ?? null
      : workout.estimatedDistanceInMeters ?? null,
  });

  const structureWorkout = editableWorkout ? previewWorkout : normalizeWorkoutForForm(workout);
  const structureSegments = structureWorkout.segments;

  const localPreviewSegments = useMemo(() => {
    if (!editableWorkout) return structureSegments;
    const milesNum = parseFloat(editMiles);
    if (!Number.isFinite(milesNum) || milesNum <= 0) return structureSegments;
    const nextMeters = milesToMeters(milesNum);
    let segments = applyPaceOffsetDeltaToSegments(
      baselineSegmentsRef.current,
      paceOffsetSecPerMile
    );
    return scaleSegmentDistances(
      segments,
      baselineMetersRef.current > 0 ? baselineMetersRef.current : nextMeters,
      nextMeters
    );
  }, [editableWorkout, editMiles, paceOffsetSecPerMile, structureSegments]);

  const activePacePreset = presetForPaceOffset(paceOffsetSecPerMile);

  const persistEditableWorkout = useCallback(async () => {
    if (!editableWorkout) return;
    const trimmedTitle = editTitle.trim();
    const milesNum = parseFloat(editMiles);
    if (!trimmedTitle || !Number.isFinite(milesNum) || milesNum <= 0) return;
    const milesKey = editMiles.trim();
    const last = lastPersistedRef.current;
    if (
      trimmedTitle === last.title &&
      milesKey === last.miles &&
      paceOffsetSecPerMile === last.paceOffset
    ) {
      return;
    }

    setWorkoutSaving(true);
    setWorkoutSaveError(null);
    try {
      const nextMeters = milesToMeters(milesNum);
      let segments = applyPaceOffsetDeltaToSegments(
        baselineSegmentsRef.current,
        paceOffsetSecPerMile
      );
      segments = scaleSegmentDistances(
        segments,
        baselineMetersRef.current > 0 ? baselineMetersRef.current : nextMeters,
        nextMeters
      );

      await api.patch(`/workouts/${workout.id}`, {
        title: trimmedTitle,
        estimatedDistanceInMeters: nextMeters,
      });
      if (segments.length > 0) {
        await api.put(`/workouts/${workout.id}/segments`, {
          segments: segmentsToPrescribePayload(segments),
        });
      }

      const { data } = await api.get<{ workout: CreateCityRunFormWorkout }>(
        `/training/workout/${workout.id}`
      );
      const updated = data?.workout ? normalizeWorkoutForForm(data.workout) : null;
      if (updated?.id) {
        setPreviewWorkout(updated);
        baselineSegmentsRef.current = updated.segments;
        baselineMetersRef.current = updated.estimatedDistanceInMeters ?? nextMeters;
        setPaceOffsetSecPerMile(0);
        lastPersistedRef.current = {
          title: trimmedTitle,
          miles: milesKey,
          paceOffset: 0,
        };
        onWorkoutChange?.(updated);
      }
    } catch {
      setWorkoutSaveError("Could not save workout changes.");
    } finally {
      setWorkoutSaving(false);
    }
  }, [editableWorkout, editTitle, editMiles, paceOffsetSecPerMile, workout.id, onWorkoutChange]);

  useEffect(() => {
    if (!editableWorkout) return;
    const trimmedTitle = editTitle.trim();
    const milesNum = parseFloat(editMiles);
    if (!trimmedTitle || !Number.isFinite(milesNum) || milesNum <= 0) return;

    const handle = window.setTimeout(() => {
      void persistEditableWorkout();
    }, 600);
    return () => window.clearTimeout(handle);
  }, [editableWorkout, editTitle, editMiles, paceOffsetSecPerMile, persistEditableWorkout]);

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
        plannedWorkoutId: workout.id,
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
        routeNeighborhood: routeNeighborhood.trim() || undefined,
        mapImageUrl: mapImageUrl.trim() || undefined,
        routePhotos: mapImageUrl.trim() ? [mapImageUrl.trim()] : undefined,
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

  const plannedMilesLabel = formatPlannedMiles(
    (editableWorkout ? previewWorkout : workout).estimatedDistanceInMeters ?? null
  );
  const existingRuns = workout.city_runs ?? [];
  const planDateLabel = formatDateLabel(workoutDateKey(workout.date));

  const workoutPanel = !hideWorkoutSummary ? (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-fit lg:sticky lg:top-6">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-sky-600" />
        {editableWorkout ? "Your workout" : "From your workout"}
      </p>

      {editableWorkout ? (
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Planned miles
            </label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={editMiles}
              onChange={(e) => setEditMiles(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Pace adjust
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(
                [
                  { id: "easier" as InvitePaceEase, label: "Easier (+15)" },
                  { id: "keep" as InvitePaceEase, label: "Keep" },
                  { id: "quicker" as InvitePaceEase, label: "Quicker (−15)" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaceOffsetSecPerMile(PACE_OFFSET_PRESETS[opt.id])}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                    activePacePreset === opt.id
                      ? "border-sky-400 bg-sky-50 text-sky-900"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step={5}
                value={Number.isFinite(paceOffsetSecPerMile) ? paceOffsetSecPerMile : 0}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.trim() === "" || raw === "-") {
                    setPaceOffsetSecPerMile(0);
                    return;
                  }
                  const n = parseInt(raw, 10);
                  setPaceOffsetSecPerMile(Number.isFinite(n) ? n : 0);
                }}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                aria-label="Pace offset sec per mile"
              />
              <span className="text-xs text-gray-600">sec/mi vs plan (+ slower · − faster)</span>
            </div>
          </div>
          {workoutSaving ? (
            <p className="text-xs text-gray-500">Saving workout…</p>
          ) : null}
          {workoutSaveError ? (
            <p className="text-xs text-red-600">{workoutSaveError}</p>
          ) : null}
        </div>
      ) : (
        <>
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
        </>
      )}

      {!editableWorkout ? null : (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
            {structureWorkout.workoutType}
          </span>
          {plannedMilesLabel ? (
            <span className="text-xs text-gray-600">{plannedMilesLabel}</span>
          ) : null}
        </div>
      )}

      {structureSegments.length > 0 ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Workout structure
          </p>
          <WorkoutStructurePreview
            segments={editableWorkout ? localPreviewSegments : structureSegments}
            workoutType={structureWorkout.workoutType}
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

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Strava route <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={stravaMapUrl}
            onChange={(e) => setStravaMapUrl(e.target.value)}
            placeholder="https://www.strava.com/routes/…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Route description <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={routeNeighborhood}
            onChange={(e) => setRouteNeighborhood(e.target.value)}
            rows={2}
            placeholder="Down George Mason and through the woods"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Route photo <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={mapImageUrl}
            onChange={(e) => setMapImageUrl(e.target.value)}
            placeholder="https://… route preview image"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          {mapImageUrl.trim() ? (
            <img
              src={mapImageUrl.trim()}
              alt="Route preview"
              className="mt-2 max-h-40 w-full rounded-lg object-cover border border-gray-200"
            />
          ) : null}
        </div>
        <p className="text-xs text-gray-500">Skip route fields if you&apos;re looping the meetup.</p>
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
