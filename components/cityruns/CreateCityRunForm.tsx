"use client";

/**
 * Athlete CityRun from workout — structure aligned with GoFastCompany CreateRunModal (minus staff sources).
 * POST /api/cityrun/from-workout. Card 1: workout summary; Card 2: full run logistics + Strava route URL.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CalendarClock, Copy, CheckCircle2, ExternalLink, MapPin, Image as ImageIcon } from "lucide-react";
import GooglePlacesAutocomplete from "@/components/RunCrew/GooglePlacesAutocomplete";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import { parseGoogleAddress, generateCitySlugFromParts } from "@/lib/parse-google-address";

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
  city_runs?: Array<{ id: string; date: string | null; createdAt: string }>;
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

const METERS_PER_MILE = 1609.34;
const MAX_ROUTE_PHOTOS = 8;

function formatPlannedMiles(meters: number | null | undefined): string | null {
  if (meters == null || meters <= 0 || !Number.isFinite(meters)) return null;
  const mi = meters / METERS_PER_MILE;
  const rounded = Math.round(mi * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} mi planned`;
}

function initialTotalMilesString(meters: number | null | undefined): string {
  if (meters == null || meters <= 0 || !Number.isFinite(meters)) return "";
  const mi = meters / METERS_PER_MILE;
  const rounded = Math.round(mi * 100) / 100;
  return String(rounded);
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postRunActivity, setPostRunActivity] = useState("");

  const [runDate, setRunDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("AM");
  const [timezone, setTimezone] = useState("");

  const [meetUpPoint, setMeetUpPoint] = useState("");
  const [meetUpStreetAddress, setMeetUpStreetAddress] = useState("");
  const [meetUpCity, setMeetUpCity] = useState("");
  const [meetUpState, setMeetUpState] = useState("");
  const [meetUpZip, setMeetUpZip] = useState("");
  const [meetUpPlaceId, setMeetUpPlaceId] = useState<string | null>(null);
  const [meetUpLat, setMeetUpLat] = useState<number | null>(null);
  const [meetUpLng, setMeetUpLng] = useState<number | null>(null);

  const [endPointSameAsStart, setEndPointSameAsStart] = useState(true);
  const [endPoint, setEndPoint] = useState("");
  const [endStreetAddress, setEndStreetAddress] = useState("");
  const [endCity, setEndCity] = useState("");
  const [endState, setEndState] = useState("");

  const [totalMiles, setTotalMiles] = useState("");

  const [stravaMapUrl, setStravaMapUrl] = useState("");
  const [mapImageUrl, setMapImageUrl] = useState("");
  const [routePhotos, setRoutePhotos] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CityRunFromWorkoutSuccess | null>(null);
  const [copiedField, setCopiedField] = useState<"rsvp" | "share" | null>(null);

  useEffect(() => {
    setTitle(workout.title);
    const d = workout.date ? new Date(workout.date) : new Date();
    setRunDate(
      !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    setTotalMiles(initialTotalMilesString(workout.estimatedDistanceInMeters ?? null));
  }, [workout.date, workout.id, workout.title, workout.estimatedDistanceInMeters]);

  useEffect(() => {
    if (!endPointSameAsStart) return;
    setEndPoint(meetUpPoint);
    setEndStreetAddress(meetUpStreetAddress);
    setEndCity(meetUpCity);
    setEndState(meetUpState);
  }, [
    endPointSameAsStart,
    meetUpPoint,
    meetUpStreetAddress,
    meetUpCity,
    meetUpState,
  ]);

  const headline = displayWorkoutListTitle({
    title: workout.title,
    workoutType: workout.workoutType,
    estimatedDistanceInMeters: workout.estimatedDistanceInMeters ?? null,
  });

  const handleStartPlaceSelected = useCallback(
    (placeData: { address: string; name: string; placeId: string; lat: number; lng: number }) => {
      const parsed = parseGoogleAddress(placeData.address);
      setMeetUpPoint(placeData.name || placeData.address);
      setMeetUpStreetAddress(parsed.streetAddress || placeData.address);
      setMeetUpCity(parsed.city || "");
      setMeetUpState(parsed.state || "");
      setMeetUpZip(parsed.zip || "");
      setMeetUpPlaceId(placeData.placeId || null);
      setMeetUpLat(placeData.lat);
      setMeetUpLng(placeData.lng);
    },
    []
  );

  const handleEndPlaceSelected = useCallback(
    (placeData: { address: string; name: string; placeId: string; lat: number; lng: number }) => {
      const parsed = parseGoogleAddress(placeData.address);
      setEndPoint(placeData.name || placeData.address);
      setEndStreetAddress(parsed.streetAddress || placeData.address);
      setEndCity(parsed.city || "");
      setEndState(parsed.state || "");
    },
    []
  );

  const handleSubmit = async () => {
    if (!LocalStorageAPI.getAthleteId()) {
      setError("Sign in so we can verify it’s your workout.");
      return;
    }
    if (!title.trim()) {
      setError("Add a title for this public run.");
      return;
    }
    if (!meetUpPoint.trim()) {
      setError("Choose a start point (search with Google Places).");
      return;
    }
    if (!meetUpStreetAddress.trim() || !meetUpCity.trim() || !meetUpState.trim()) {
      setError("Street address, city, and state are required — pick a Places result or fill them in.");
      return;
    }

    const gofastCity = generateCitySlugFromParts(meetUpCity, meetUpState);
    if (!gofastCity) {
      setError("We need a valid city for listings.");
      return;
    }

    if (!endPointSameAsStart) {
      if (!endPoint.trim() || !endStreetAddress.trim() || !endCity.trim() || !endState.trim()) {
        setError("Fill in end location, or check “Finish same as start”.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const hourNum =
        startHour === "" ? undefined : Math.min(12, Math.max(1, parseInt(startHour, 10) || 0));
      const minuteNum =
        startMinute === "" ? undefined : Math.min(59, Math.max(0, parseInt(startMinute, 10) || 0));

      const photos = routePhotos.map((u) => u.trim()).filter(Boolean).slice(0, MAX_ROUTE_PHOTOS);

      const { data } = await api.post<CityRunFromWorkoutSuccess>("/cityrun/from-workout", {
        workoutId: workout.id,
        title: title.trim(),
        gofastCity,
        cityName: meetUpCity.trim(),
        state: meetUpState.trim(),
        date: runDate,
        meetUpPoint: meetUpPoint.trim(),
        meetUpStreetAddress: meetUpStreetAddress.trim(),
        meetUpCity: meetUpCity.trim(),
        meetUpState: meetUpState.trim(),
        meetUpZip: meetUpZip.trim() || undefined,
        meetUpPlaceId: meetUpPlaceId || undefined,
        meetUpLat: meetUpLat ?? undefined,
        meetUpLng: meetUpLng ?? undefined,
        description: description.trim() || undefined,
        postRunActivity: postRunActivity.trim() || undefined,
        endPoint: endPointSameAsStart ? undefined : endPoint.trim() || undefined,
        endStreetAddress: endPointSameAsStart ? undefined : endStreetAddress.trim() || undefined,
        endCity: endPointSameAsStart ? undefined : endCity.trim() || undefined,
        endState: endPointSameAsStart ? undefined : endState.trim() || undefined,
        totalMiles: totalMiles.trim() ? parseFloat(totalMiles) : undefined,
        stravaMapUrl: stravaMapUrl.trim() || undefined,
        mapImageUrl: mapImageUrl.trim() || undefined,
        routePhotos: photos.length > 0 ? photos : undefined,
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

  const plannedMilesLabel = formatPlannedMiles(workout.estimatedDistanceInMeters ?? null);
  const existingRuns = workout.city_runs ?? [];

  return (
    <div className={className}>
      {!hideWorkoutSummary ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600" />
            Your workout
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
              {workout.workoutType}
            </span>
            {plannedMilesLabel ? (
              <span className="text-xs text-gray-600">{plannedMilesLabel}</span>
            ) : null}
          </div>
          <p className="font-medium text-gray-900 text-base">{headline}</p>
          {workout.description ? (
            <p className="text-gray-600 text-sm mt-2 whitespace-pre-wrap">{workout.description}</p>
          ) : null}
          {workout.segments.length > 0 ? (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Segments
              </p>
              <ul className="text-sm text-gray-700 space-y-1.5">
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
            </div>
          ) : null}
        </div>
      ) : null}

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
                    ? ` · ${new Date(r.date).toLocaleDateString(undefined, {
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

      <div className="space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-orange-500" />
          Run logistics
        </p>
        <p className="text-xs text-gray-500 -mt-3">
          Same fields staff use for public CityRuns — add a Strava route URL so the map shows on your invite.
        </p>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Post-run activity (optional)
          </label>
          <textarea
            value={postRunActivity}
            onChange={(e) => setPostRunActivity(e.target.value)}
            rows={2}
            placeholder="E.g., Coffee nearby, stretching…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Date
            </label>
            <input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Start time (optional)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={1}
                max={12}
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
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
                className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                aria-label="Minute"
              />
              <select
                value={startPeriod}
                onChange={(e) => setStartPeriod(e.target.value as "AM" | "PM")}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm"
                aria-label="AM or PM"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
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

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Start point
          </label>
          <GooglePlacesAutocomplete
            value={meetUpPoint}
            onChange={(e) => setMeetUpPoint(e.target.value)}
            onPlaceSelected={handleStartPlaceSelected}
            placeholder="Search for a location…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">Pick a result to fill address and city for listings.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Street address
          </label>
          <input
            type="text"
            value={meetUpStreetAddress}
            onChange={(e) => setMeetUpStreetAddress(e.target.value)}
            placeholder="e.g. 1234 Wilson Blvd"
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
              value={meetUpCity}
              onChange={(e) => setMeetUpCity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              State
            </label>
            <input
              type="text"
              value={meetUpState}
              maxLength={2}
              onChange={(e) => setMeetUpState(e.target.value.toUpperCase())}
              placeholder="VA"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            ZIP (optional)
          </label>
          <input
            type="text"
            value={meetUpZip}
            onChange={(e) => setMeetUpZip(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={endPointSameAsStart}
              onChange={(e) => {
                const on = e.target.checked;
                setEndPointSameAsStart(on);
                if (!on) {
                  setEndPoint("");
                  setEndStreetAddress("");
                  setEndCity("");
                  setEndState("");
                }
              }}
              className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-800">Finish same as start</span>
          </label>

          {!endPointSameAsStart ? (
            <div className="space-y-3 pl-1">
              <GooglePlacesAutocomplete
                value={endPoint}
                onChange={(e) => setEndPoint(e.target.value)}
                onPlaceSelected={handleEndPlaceSelected}
                placeholder="Search end location…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={endStreetAddress}
                onChange={(e) => setEndStreetAddress(e.target.value)}
                placeholder="End street address"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={endCity}
                  onChange={(e) => setEndCity(e.target.value)}
                  placeholder="End city"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={endState}
                  maxLength={2}
                  onChange={(e) => setEndState(e.target.value.toUpperCase())}
                  placeholder="End state"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Total miles
          </label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={totalMiles}
            onChange={(e) => setTotalMiles(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Pre-filled from your workout; edit if needed.</p>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Strava route URL
          </label>
          <input
            type="url"
            value={stravaMapUrl}
            onChange={(e) => setStravaMapUrl(e.target.value)}
            placeholder="https://www.strava.com/routes/…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">
            No URL usually means no route on the public invite page — add one if you can.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Map image URL (optional)
          </label>
          <input
            type="url"
            value={mapImageUrl}
            onChange={(e) => setMapImageUrl(e.target.value)}
            placeholder="Screenshot or image URL of your route"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          {mapImageUrl.trim() ? (
            <img
              src={mapImageUrl.trim()}
              alt="Map preview"
              className="mt-2 max-w-md rounded-lg border border-gray-200"
              onError={(ev) => {
                (ev.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" />
            Route photos (optional, up to {MAX_ROUTE_PHOTOS})
          </label>
          <div className="space-y-2">
            {routePhotos.map((photo, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="url"
                  value={photo}
                  onChange={(e) => {
                    const next = [...routePhotos];
                    next[idx] = e.target.value;
                    setRoutePhotos(next);
                  }}
                  placeholder="Image URL"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setRoutePhotos(routePhotos.filter((_, i) => i !== idx))}
                  className="px-3 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-100"
                >
                  Remove
                </button>
              </div>
            ))}
            {routePhotos.length < MAX_ROUTE_PHOTOS ? (
              <button
                type="button"
                onClick={() => setRoutePhotos([...routePhotos, ""])}
                className="text-sm text-sky-700 font-medium hover:underline"
              >
                + Add photo URL
              </button>
            ) : null}
          </div>
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
