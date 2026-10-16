"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ExternalLink, MapPin, Route } from "lucide-react";
import GooglePlacesAutocomplete, {
  type GooglePlaceSelectedData,
} from "@/components/RunCrew/GooglePlacesAutocomplete";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import {
  generateCitySlugFromParts,
  parseGoogleAddressFromComponents,
} from "@/lib/parse-google-address";
import RoutesDiscoverPicker from "@/components/runs/RoutesDiscoverPicker";
import CityRunRouteMapUploadField from "@/components/cityruns/CityRunRouteMapUploadField";
import CityRunRoutePhotosField from "@/components/cityruns/CityRunRoutePhotosField";
import { useApplyInitialRoute } from "@/lib/city-run/use-apply-initial-route";
import type { CityRunFromWorkoutSuccess } from "@/components/cityruns/CreateCityRunForm";
import {
  applySavedRouteToFormFields,
  clearSavedRouteFormFields,
  type SavedRouteSnapshot,
} from "@/lib/city-run/saved-route-snapshot";

function formatMeetupConfirmation(city: string, state: string): string {
  const c = city.trim();
  const s = state.trim().toUpperCase();
  if (!c) return "";
  if (s === "DC" || c.toLowerCase() === "dc") return `${c} · DC`;
  if (s) return `${c}, ${s}`;
  return c;
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

type Props = { initialRouteId?: string | null };

export default function CityRunMeetupOnlyForm({ initialRouteId = null }: Props) {
  const [meetupTitle, setMeetupTitle] = useState("");
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

  const [totalMiles, setTotalMiles] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRoutePhotos, setSelectedRoutePhotos] = useState<string[]>([]);
  const [mapImageUrl, setMapImageUrl] = useState("");
  const [stravaMapUrl, setStravaMapUrl] = useState("");
  const [routeNeighborhood, setRouteNeighborhood] = useState("");

  const handlePickSavedRoute = (snap: SavedRouteSnapshot) => {
    setSelectedRouteId(snap.routeId);
    setSelectedRoutePhotos(snap.routePhotos);
    applySavedRouteToFormFields(snap, {
      setStravaMapUrl,
      setRouteNeighborhood,
      setMapImageUrl,
      setTotalMiles,
    });
  };

  const handleClearSavedRoute = () => {
    setSelectedRouteId(null);
    setSelectedRoutePhotos([]);
    clearSavedRouteFormFields({
      setStravaMapUrl,
      setRouteNeighborhood,
      setMapImageUrl,
    });
  };

  useApplyInitialRoute({
    initialRouteId,
    onRouteId: setSelectedRouteId,
    onRoutePhotos: setSelectedRoutePhotos,
    fieldSetters: {
      setStravaMapUrl,
      setRouteNeighborhood,
      setMapImageUrl,
      setTotalMiles,
    },
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CityRunFromWorkoutSuccess | null>(null);
  const [copiedField, setCopiedField] = useState<"rsvp" | "share" | null>(null);

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

  const handleSubmit = async () => {
    if (!LocalStorageAPI.getAthleteId()) {
      setError("Sign in to create a run invite.");
      return;
    }
    const socialTitle = meetupTitle.trim();
    if (!socialTitle) {
      setError("Add a title for this meetup.");
      return;
    }
    if (!meetUpPoint.trim() || !meetUpPlaceSet) {
      setError("Choose a meetup spot from the search results.");
      return;
    }
    if (!meetupDate.trim()) {
      setError("Pick a meetup date.");
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
      const milesNum = parseFloat(totalMiles);

      const { data } = await api.post<CityRunFromWorkoutSuccess>("/cityrun/from-workout", {
        title: socialTitle,
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
        description: description.trim() || undefined,
        totalMiles:
          Number.isFinite(milesNum) && milesNum > 0 ? milesNum : undefined,
        ...(selectedRouteId ? { routeId: selectedRouteId } : {}),
        stravaMapUrl: stravaMapUrl.trim() || undefined,
        routeNeighborhood: routeNeighborhood.trim() || undefined,
        mapImageUrl: mapImageUrl.trim() || undefined,
        routePhotos: selectedRoutePhotos.length > 0 ? selectedRoutePhotos : undefined,
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
      setError(err.response?.data?.error || "Could not create run invite.");
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
    const joinUrl = success.joinSignupUrl || success.shareUrl;
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-4">
        <p className="font-semibold text-green-900">Invite created</p>
        <p className="text-sm text-green-800">Share the link so others can RSVP.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyToClipboard(joinUrl, "rsvp")}
            className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
          >
            {copiedField === "rsvp" ? "Copied" : "Copy invite link"}
          </button>
          <Link
            href={success.path}
            className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-900"
          >
            <ExternalLink className="w-4 h-4" />
            Open run page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          None — just meet up and go
        </p>
        <p className="text-sm text-gray-600">
          No workout attached. Pick time and place, add an optional route, and share an invite.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Meetup title *
        </label>
        <input
          type="text"
          value={meetupTitle}
          onChange={(e) => setMeetupTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Saturday morning group run"
        />
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
            {meetUpPoint.trim()} · {meetupConfirmation}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
          <CalendarClock className="w-3.5 h-3.5" />
          Meetup date *
        </label>
        <input
          type="date"
          value={meetupDate}
          onChange={(e) => setMeetupDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min={1}
          max={12}
          placeholder="Hour"
          value={startHour}
          onChange={(e) => setStartHour(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={0}
          max={59}
          placeholder="Min"
          value={startMinute}
          onChange={(e) => setStartMinute(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={startPeriod}
          onChange={(e) => setStartPeriod(e.target.value as "AM" | "PM")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Miles (optional)
        </label>
        <input
          type="number"
          step={0.1}
          min={0}
          value={totalMiles}
          onChange={(e) => setTotalMiles(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <Route className="w-4 h-4 text-orange-500" />
          Route (optional)
        </p>
        <RoutesDiscoverPicker
          selectedRouteId={selectedRouteId}
          onSelect={handlePickSavedRoute}
          onClear={handleClearSavedRoute}
        />
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Strava route URL <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            placeholder="https://www.strava.com/routes/…"
            value={stravaMapUrl}
            onChange={(e) => setStravaMapUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <CityRunRouteMapUploadField
          mapImageUrl={mapImageUrl}
          onChange={setMapImageUrl}
          onError={setError}
        />
        <textarea
          placeholder="Route description"
          value={routeNeighborhood}
          onChange={(e) => setRouteNeighborhood(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <CityRunRoutePhotosField
          photos={selectedRoutePhotos}
          onChange={setSelectedRoutePhotos}
          onError={setError}
        />
        <textarea
          placeholder="Notes for your group"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSubmit()}
        className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create invite"}
      </button>
    </div>
  );
}
