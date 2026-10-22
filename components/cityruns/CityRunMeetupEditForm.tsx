"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Route } from "lucide-react";
import GooglePlacesAutocomplete, {
  type GooglePlaceSelectedData,
} from "@/components/RunCrew/GooglePlacesAutocomplete";
import CityRunPostInviteRouteStep from "@/components/cityruns/CityRunPostInviteRouteStep";
import api from "@/lib/api";
import { ensureAthleteIdInStorage } from "@/lib/ensure-athlete-session";
import {
  generateCitySlugFromParts,
  parseGoogleAddressFromComponents,
} from "@/lib/parse-google-address";
import type { HostedRunInviteRouteSnap } from "@/lib/city-run/list-athlete-hosted-invites";
import CityRunProfileMetaFields from "@/components/cityruns/CityRunProfileMetaFields";

function ManageCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  );
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
  meetUpNote: string | null;
  description: string | null;
  routeNeighborhood: string | null;
  routeId: string | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  profileEmoji: string | null;
  coverPhotoUrl: string | null;
  workoutDescription: string | null;
  route: HostedRunInviteRouteSnap | null;
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
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [meetUpNote, setMeetUpNote] = useState("");
  const [aboutThisRun, setAboutThisRun] = useState("");
  const [gorunPath, setGorunPath] = useState("/host-a-run");
  const [routeSnap, setRouteSnap] = useState<HostedRunInviteRouteSnap | null>(null);
  const [runMapImageUrl, setRunMapImageUrl] = useState<string | null>(null);
  const [runStravaMapUrl, setRunStravaMapUrl] = useState<string | null>(null);
  const [workoutDescription, setWorkoutDescription] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [routeAttachKey, setRouteAttachKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const applyInvite = useCallback((inv: InviteDetail) => {
    setMeetupTitle(inv.title);
    setMeetupDate(dateInputFromIso(inv.date));
    setStartHour(inv.startTimeHour != null ? String(inv.startTimeHour) : "");
    setStartMinute(
      inv.startTimeMinute != null ? String(inv.startTimeMinute).padStart(2, "0") : "",
    );
    setStartPeriod(
      inv.startTimePeriod === "PM" || inv.startTimePeriod === "AM" ? inv.startTimePeriod : "AM",
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
    setMeetUpNote(inv.meetUpNote ?? "");
    setAboutThisRun(inv.description ?? "");
    setGorunPath(inv.gorunPath);
    setRouteSnap(inv.route);
    setRunMapImageUrl(inv.mapImageUrl ?? inv.route?.mapImageUrl ?? null);
    setRunStravaMapUrl(inv.stravaMapUrl ?? inv.route?.stravaMapUrl ?? null);
    setWorkoutDescription(inv.workoutDescription);
    setProfileEmoji(inv.profileEmoji ?? "");
    setCoverPhotoUrl(inv.coverPhotoUrl ?? "");
    setRouteAttachKey((k) => k + 1);
  }, []);

  const hydrate = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const res = await api.get<{ invite?: InviteDetail }>(
        `/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`,
      );
      const inv = res.data.invite;
      if (!inv) {
        setLoadError("Run invite not found.");
        return;
      }
      applyInvite(inv);
    } catch {
      if (!opts?.silent) setLoadError("Could not load this run invite.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [cityRunId, applyInvite]);

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
    setSaveSuccess(false);
    try {
      const hourNum = Math.min(12, Math.max(1, parseInt(startHour, 10)));
      const minuteNum = Math.min(59, Math.max(0, parseInt(startMinute, 10) || 0));
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
        meetUpNote: meetUpNote.trim() || null,
        description: aboutThisRun.trim() || null,
        startTimeHour: hourNum,
        startTimeMinute: minuteNum,
        startTimePeriod: startPeriod,
        profileEmoji: profileEmoji.trim() || null,
        coverPhotoUrl: coverPhotoUrl.trim() || null,
      });
      setSaveSuccess(true);
      const path = gorunPath;
      redirectTimer.current = setTimeout(() => {
        router.push(path);
      }, 800);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const mapPreviewUrl = runMapImageUrl?.trim() || routeSnap?.mapImageUrl?.trim() || null;
  const stravaUrl = runStravaMapUrl?.trim() || routeSnap?.stravaMapUrl?.trim() || null;

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
        <Link href="/host-a-run" className="mt-3 inline-block text-sm font-semibold underline">
          Back to Run
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/host-a-run"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Runs I created
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Manage run</h1>
      {saveSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">Run updated</p>
          <p className="mt-0.5 text-emerald-800">Opening your run page…</p>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <ManageCard title="Meta">
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Title</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={meetupTitle}
            onChange={(e) => setMeetupTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Description</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Why join — early crew, training buddy, social pace, etc.
          </span>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[100px]"
            value={aboutThisRun}
            onChange={(e) => setAboutThisRun(e.target.value)}
            placeholder="Short blurb for the invite."
          />
        </label>
        <CityRunProfileMetaFields
          profileEmoji={profileEmoji}
          onProfileEmojiChange={setProfileEmoji}
          coverPhotoUrl={coverPhotoUrl}
          onCoverPhotoUrlChange={setCoverPhotoUrl}
          onUploadError={setError}
        />
      </ManageCard>

      <ManageCard title="Meetup">
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
            Meetup spot
          </span>
          <GooglePlacesAutocomplete
            value={meetUpPoint}
            onChange={(e) => {
              setMeetUpPoint(e.target.value);
              setMeetUpPlaceSet(false);
            }}
            onPlaceSelected={handleStartPlaceSelected}
            placeholder="Search meetup spot"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Meetup note</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Parking, landmarks, or how to find the group at the meetup spot.
          </span>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[80px]"
            value={meetUpNote}
            onChange={(e) => setMeetUpNote(e.target.value)}
            placeholder="E.g. We meet at the back of the parking lot."
          />
        </label>
      </ManageCard>

      <ManageCard title="Route">
        {routeSnap || mapPreviewUrl ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Route className="h-4 w-4 text-orange-500" />
              Attached route
            </p>
            {routeSnap?.name ? (
              <p className="font-semibold text-gray-900">{routeSnap.name}</p>
            ) : null}
            {mapPreviewUrl ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mapPreviewUrl} alt="Route map" className="w-full h-auto" />
              </div>
            ) : null}
            {workoutDescription?.trim() ? (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {workoutDescription.trim()}
              </p>
            ) : null}
            {stravaUrl ? (
              <a
                href={stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                View on Strava
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No route attached yet.</p>
        )}
        <CityRunPostInviteRouteStep
          key={routeAttachKey}
          cityRunId={cityRunId}
          variant="edit"
          onSkip={() => undefined}
          onAttached={() => void hydrate({ silent: true })}
        />
      </ManageCard>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={busy || saveSuccess}
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
