"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import GooglePlacesAutocomplete from "@/components/runmanage/GooglePlacesAutocomplete";
import { parseGoogleAddress } from "@/lib/parse-google-address";
import { generateCitySlugFromParts } from "@/lib/utils/parseAddress";
import runmanageApi from "@/lib/runmanage/api-client";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import type { SeriesManageRow } from "@/lib/runmanage/series-manage-list";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

type ClubOption = { id: string; name: string; city?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  citySlug: string;
  initial?: SeriesManageRow | null;
};

export function RunManageSeriesMetaForm({ open, onClose, onSaved, citySlug, initial }: Props) {
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [runClubId, setRunClubId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("TUESDAY");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [meetUpPoint, setMeetUpPoint] = useState("");
  const [meetUpStreetAddress, setMeetUpStreetAddress] = useState("");
  const [meetUpCity, setMeetUpCity] = useState("");
  const [meetUpState, setMeetUpState] = useState("");
  const [meetUpPlaceId, setMeetUpPlaceId] = useState("");
  const [meetUpLat, setMeetUpLat] = useState<number | null>(null);
  const [meetUpLng, setMeetUpLng] = useState<number | null>(null);
  const [startTimeHour, setStartTimeHour] = useState("");
  const [startTimeMinute, setStartTimeMinute] = useState("");
  const [startTimePeriod, setStartTimePeriod] = useState("AM");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setClubsLoading(true);
      try {
        const res = await runmanageApi.get("/api/runmanage/run-clubs?all=1");
        const list = (res.data?.clubs ?? []) as ClubOption[];
        setClubs(Array.isArray(list) ? list : []);
      } catch {
        setClubs([]);
      } finally {
        setClubsLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setRunClubId(initial.runClubId ?? "");
      setDayOfWeek(initial.dayOfWeek.toUpperCase());
      setName(initial.name ?? "");
      setDescription(initial.description ?? "");
      setMeetUpPoint(initial.meetUpPoint ?? "");
      setMeetUpCity(initial.meetUpCity ?? "");
      setMeetUpState(initial.meetUpState ?? "");
      setStartTimeHour(initial.startTimeHour != null ? String(initial.startTimeHour) : "");
      setStartTimeMinute(
        initial.startTimeMinute != null ? String(initial.startTimeMinute).padStart(2, "0") : ""
      );
      setStartTimePeriod(initial.startTimePeriod?.trim() || "AM");
      setMeetUpStreetAddress("");
      setMeetUpPlaceId("");
      setMeetUpLat(null);
      setMeetUpLng(null);
    } else {
      setRunClubId("");
      setDayOfWeek("TUESDAY");
      setName("");
      setDescription("");
      setMeetUpPoint("");
      setMeetUpStreetAddress("");
      setMeetUpCity("");
      setMeetUpState("");
      setMeetUpPlaceId("");
      setMeetUpLat(null);
      setMeetUpLng(null);
      setStartTimeHour("");
      setStartTimeMinute("");
      setStartTimePeriod("AM");
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open || initial || !runClubId || !dayOfWeek) return;
    const club = clubs.find((c) => c.id === runClubId);
    if (club && !name.trim()) {
      setName(`${club.name} ${formatDayLabel(dayOfWeek)} Run`);
    }
  }, [open, initial, runClubId, dayOfWeek, clubs, name]);

  const handleSubmit = async () => {
    if (!runClubId.trim() || !dayOfWeek) {
      setError("Run club and day are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const resolvedCitySlug =
      citySlug.trim() ||
      generateCitySlugFromParts(meetUpCity, meetUpState) ||
      undefined;
    const payload = {
      runClubId: runClubId.trim(),
      dayOfWeek,
      name: name.trim() || null,
      description: description.trim() || null,
      citySlug: resolvedCitySlug ?? null,
      meetUpPoint: meetUpPoint.trim() || null,
      meetUpStreetAddress: meetUpStreetAddress.trim() || null,
      meetUpCity: meetUpCity.trim() || null,
      meetUpState: meetUpState.trim() || null,
      meetUpPlaceId: meetUpPlaceId.trim() || null,
      meetUpLat,
      meetUpLng,
      startTimeHour: startTimeHour ? parseInt(startTimeHour, 10) : null,
      startTimeMinute: startTimeMinute ? parseInt(startTimeMinute, 10) : null,
      startTimePeriod: startTimePeriod.trim() || null,
    };

    try {
      if (initial?.id) {
        const res = await runmanageApi.patch(
          `/api/runmanage/run-series/${encodeURIComponent(initial.id)}`,
          payload
        );
        if (!res.data?.success) throw new Error(res.data?.error || "Save failed");
      } else {
        const res = await runmanageApi.post("/api/runmanage/run-series", payload);
        if (!res.data?.success) throw new Error(res.data?.error || "Save failed");
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {initial ? "Edit series" : "New weekly series"}
            </h2>
            <p className="text-xs text-gray-500">Series meta only — no dated run or route.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Run club</span>
            <select
              value={runClubId}
              onChange={(e) => setRunClubId(e.target.value)}
              disabled={clubsLoading}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select club…</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` (${c.city})` : ""}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-sm font-medium text-gray-700">Day</span>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDayOfWeek(d)}
                  className={`rounded-lg py-1.5 text-xs font-medium ${
                    dayOfWeek === d
                      ? "bg-sky-600 text-white"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Series name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Meet-up</span>
            <GooglePlacesAutocomplete
              value={meetUpPoint}
              onChange={(e) => setMeetUpPoint(e.target.value)}
              onPlaceSelected={(placeData) => {
                const parsed = parseGoogleAddress(placeData.address);
                setMeetUpPoint(placeData.name || placeData.address);
                setMeetUpStreetAddress(parsed.streetAddress || "");
                setMeetUpCity(parsed.city || "");
                setMeetUpState(parsed.state || "");
                setMeetUpPlaceId(placeData.placeId || "");
                setMeetUpLat(placeData.lat);
                setMeetUpLng(placeData.lng);
              }}
              placeholder="Search location…"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={12}
              value={startTimeHour}
              onChange={(e) => setStartTimeHour(e.target.value.replace(/\D/g, ""))}
              placeholder="Hr"
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
            />
            <span className="text-gray-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={startTimeMinute}
              onChange={(e) => setStartTimeMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="Min"
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
            />
            <select
              value={startTimePeriod}
              onChange={(e) => setStartTimePeriod(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save series
          </button>
        </div>
      </div>
    </div>
  );
}
