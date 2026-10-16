"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import GooglePlacesAutocomplete, {
  type GooglePlaceSelectedData,
} from "@/components/RunCrew/GooglePlacesAutocomplete";
import api from "@/lib/api";
import { ensureAthleteIdInStorage } from "@/lib/ensure-athlete-session";
import {
  generateCitySlugFromParts,
  parseGoogleAddressFromComponents,
} from "@/lib/parse-google-address";
import { PACE_OPTIONS } from "@/lib/runTypes";

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

type InviteDetail = {
  id: string;
  title: string;
  date: string;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpPlaceId: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  description: string | null;
  routeNeighborhood: string | null;
  totalMiles: number | null;
  pace: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  gorunPath: string;
};

function dateInputFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type Props = { cityRunId: string };

export default function CityRunMeetupEditForm({ cityRunId }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [pace, setPace] = useState("Various");
  const [description, setDescription] = useState("");
  const [routeNeighborhood, setRouteNeighborhood] = useState("");
  const [gorunPath, setGorunPath] = useState("/build-a-run");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ invite?: InviteDetail }>(
        `/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`,
      );
      const inv = res.data.invite;
      if (!inv) {
        setLoadError("Run invite not found.");
        return;
      }
      setMeetupTitle(inv.title);
      setMeetupDate(dateInputFromIso(inv.date));
      setStartHour(inv.startTimeHour != null ? String(inv.startTimeHour) : "");
      setStartMinute(
        inv.startTimeMinute != null ? String(inv.startTimeMinute).padStart(2, "0") : "",
      );
      setStartPeriod(
        inv.startTimePeriod === "PM" || inv.startTimePeriod === "AM"
          ? inv.startTimePeriod
          : "AM",
      );
      setMeetUpPoint(inv.meetUpPoint);
      setMeetUpStreetAddress(inv.meetUpStreetAddress ?? "");
      setMeetUpCity(inv.meetUpCity ?? "");
      setMeetUpState(inv.meetUpState ?? "");
      setMeetUpZip(inv.meetUpZip ?? "");
      setMeetUpPlaceId(inv.meetUpPlaceId);
      setMeetUpLat(inv.meetUpLat);
      setMeetUpLng(inv.meetUpLng);
      setMeetUpPlaceSet(Boolean(inv.meetUpPoint.trim()));
      setTotalMiles(inv.totalMiles != null ? String(inv.totalMiles) : "");
      setPace(inv.pace?.trim() || "Various");
      setDescription(inv.description ?? "");
      setRouteNeighborhood(inv.routeNeighborhood ?? "");
      setGorunPath(inv.gorunPath);
    } catch {
      setLoadError("Could not load this run invite.");
    } finally {
      setLoading(false);
    }
  }, [cityRunId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const handleStartPlaceSelected = useCallback((placeData: GooglePlaceSelectedData) => {
    const parsed = parseGoogleAddressFromComponents(
      placeData.address,
      placeData.addressComponents,
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

  const handleSave = async () => {
    const athleteId = await ensureAthleteIdInStorage();
    if (!athleteId) {
      setError("Sign in to save changes.");
      return;
    }
    if (!meetupTitle.trim()) {
      setError("Add a title.");
      return;
    }
    if (!meetUpPoint.trim() || !meetUpPlaceSet) {
      setError("Choose a meetup spot from search.");
      return;
    }
    if (!meetupDate.trim()) {
      setError("Pick a date.");
      return;
    }
    if (!hasValidStartTime(startHour, startMinute, startPeriod)) {
      setError("Add a valid start time.");
      return;
    }
    const citySlug = generateCitySlugFromParts(meetUpCity, meetUpState);
    if (!citySlug) {
      setError("We need a valid city.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const hourNum = Math.min(12, Math.max(1, parseInt(startHour, 10)));
      const minuteNum = Math.min(59, Math.max(0, parseInt(startMinute, 10) || 0));
      const milesNum = parseFloat(totalMiles);
      await api.patch(`/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`, {
        title: meetupTitle.trim(),
        date: meetupDate,
        meetUpPoint: meetUpPoint.trim(),
        meetUpStreetAddress: meetUpStreetAddress.trim() || meetUpPoint.trim(),
        meetUpCity: meetUpCity.trim(),
        meetUpState: meetUpState.trim() || undefined,
        meetUpZip: meetUpZip.trim() || undefined,
        meetUpPlaceId: meetUpPlaceId || undefined,
        meetUpLat: meetUpLat ?? undefined,
        meetUpLng: meetUpLng ?? undefined,
        description: description.trim() || null,
        routeNeighborhood: routeNeighborhood.trim() || null,
        pace: pace.trim() && pace !== "Various" ? pace : null,
        totalMiles:
          Number.isFinite(milesNum) && milesNum > 0 ? milesNum : null,
        startTimeHour: hourNum,
        startTimeMinute: minuteNum,
        startTimePeriod: startPeriod,
      });
      setSaved(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        <p>{loadError}</p>
        <Link href="/build-a-run" className="mt-3 inline-block text-sm font-semibold underline">
          Back to Run
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/build-a-run"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Runs I created
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Edit run invite</h1>
      {saved ? (
        <p className="text-sm text-emerald-700 font-medium">Saved.</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-gray-800">Title</span>
        <input
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          value={meetupTitle}
          onChange={(e) => setMeetupTitle(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-800">Date</span>
        <input
          type="date"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          value={meetupDate}
          onChange={(e) => setMeetupDate(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Hour</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={startHour}
            onChange={(e) => setStartHour(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Min</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={startMinute}
            onChange={(e) => setStartMinute(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-800">AM/PM</span>
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={startPeriod}
            onChange={(e) => setStartPeriod(e.target.value as "AM" | "PM")}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
      <div>
        <span className="text-sm font-medium text-gray-800 flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          Meetup
        </span>
        <GooglePlacesAutocomplete
          value={meetUpPoint}
          onChange={(e) => {
            setMeetUpPoint(e.target.value);
            setMeetUpPlaceSet(false);
          }}
          onPlaceSelected={handleStartPlaceSelected}
          placeholder="Search meetup spot"
        />
      </div>
      <label className="block">
        <span className="text-sm font-medium text-gray-800">Route neighborhood</span>
        <input
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          value={routeNeighborhood}
          onChange={(e) => setRouteNeighborhood(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-800">Miles</span>
        <input
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          value={totalMiles}
          onChange={(e) => setTotalMiles(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-800">Pace</span>
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          value={pace}
          onChange={(e) => setPace(e.target.value)}
        >
          {PACE_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-800">Meetup note</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <Link
          href={gorunPath}
          className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Open run page
        </Link>
      </div>
    </div>
  );
}
