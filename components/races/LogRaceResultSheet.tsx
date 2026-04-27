"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";
import { utcDateOnly } from "@/lib/training/plan-utils";
import { formatDurationSecondsToClock } from "@/lib/race-result-helpers";

export type LogRaceResultSheetProps = {
  open: boolean;
  onClose: () => void;
  /** `race_registry.id` */
  raceRegistryId: string;
  raceName: string;
  /** ISO or Y-m-d; used to suggest same-day activities */
  raceDateYmd: string;
  goalId?: string | null;
  signupId?: string | null;
  onSaved?: () => void;
};

type ActivityRow = {
  id: string;
  source: string;
  activityName: string | null;
  startTime: string | null;
  duration: number | null;
  distance: number | null;
};

type ResultRow = {
  id: string;
  officialFinishTime: string | null;
  chipTime: string | null;
  gunTime: string | null;
  actualAvgPaceSecPerMile: number | null;
  overallPlace: number | null;
  ageGroupPlace: number | null;
  notes: string | null;
  garminActivityId: string | null;
  source: string;
};

export default function LogRaceResultSheet({
  open,
  onClose,
  raceRegistryId,
  raceName,
  raceDateYmd,
  goalId,
  signupId,
  onSaved,
}: LogRaceResultSheetProps) {
  const [loading, setLoading] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ResultRow | null>(null);

  const [finishTime, setFinishTime] = useState("");
  const [timePrimary, setTimePrimary] = useState<"net" | "gun">("net");
  const [overallPlace, setOverallPlace] = useState("");
  const [ageGroupPlace, setAgeGroupPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [garminActivityId, setGarminActivityId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const loadExisting = useCallback(async () => {
    const res = await api.get("/race-results", { params: { raceRegistryId } });
    const list = res.data?.results;
    if (Array.isArray(list) && list[0]) {
      const r = list[0] as ResultRow;
      setExisting(r);
      setFinishTime(r.officialFinishTime ?? r.chipTime ?? r.gunTime ?? "");
      if (r.gunTime && !r.chipTime) setTimePrimary("gun");
      else setTimePrimary("net");
      setOverallPlace(r.overallPlace != null ? String(r.overallPlace) : "");
      setAgeGroupPlace(r.ageGroupPlace != null ? String(r.ageGroupPlace) : "");
      setNotes(r.notes ?? "");
      setGarminActivityId(r.garminActivityId);
    } else {
      setExisting(null);
      setFinishTime("");
      setTimePrimary("net");
      setOverallPlace("");
      setAgeGroupPlace("");
      setNotes("");
      setGarminActivityId(null);
    }
  }, [raceRegistryId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void loadExisting();
  }, [open, loadExisting]);

  useEffect(() => {
    if (!open) return;
    setLoadingActivities(true);
    void api
      .get("/athlete/activities", { params: { limit: 80 } })
      .then((res) => {
        const raw = res.data?.activities;
        if (!Array.isArray(raw)) {
          setActivities([]);
          return;
        }
        setActivities(
          raw.map(
            (a: {
              id: string;
              source?: string;
              activityName?: string | null;
              startTime?: string | null;
              duration?: number | null;
              distance?: number | null;
            }) => ({
              id: a.id,
              source: a.source ?? "garmin",
              activityName: a.activityName ?? null,
              startTime: a.startTime ?? null,
              duration: a.duration ?? null,
              distance: a.distance ?? null,
            })
          )
        );
      })
      .catch(() => setActivities([]))
      .finally(() => setLoadingActivities(false));
  }, [open, raceDateYmd]);

  const raceDayUtc = (() => {
    try {
      return utcDateOnly(new Date(raceDateYmd.includes("T") ? raceDateYmd : `${raceDateYmd}T12:00:00Z`));
    } catch {
      return null;
    }
  })();

  const sameDayActivities = activities.filter((a) => {
    if (!a.startTime || !raceDayUtc) return false;
    try {
      const t = utcDateOnly(new Date(a.startTime));
      return t.getTime() === raceDayUtc.getTime();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = finishTime.trim();
    if (!garminActivityId && !trimmed) {
      setError("Enter a finish time or link a synced activity.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        raceRegistryId,
        goalId: goalId ?? null,
        signupId: signupId ?? null,
        officialFinishTime: trimmed || null,
        chipTime: timePrimary === "net" && trimmed ? trimmed : null,
        gunTime: timePrimary === "gun" && trimmed ? trimmed : null,
        garminActivityId: garminActivityId || null,
        notes: notes.trim() || null,
        overallPlace: overallPlace.trim() ? parseInt(overallPlace, 10) : null,
        ageGroupPlace: ageGroupPlace.trim() ? parseInt(ageGroupPlace, 10) : null,
      };
      if (!trimmed && garminActivityId) {
        body.officialFinishTime = null;
        body.chipTime = null;
        body.gunTime = null;
      }
      await api.post("/race-results", body);
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : "Save failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-race-result-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
          <h2 id="log-race-result-title" className="text-lg font-semibold text-gray-900 pr-2">
            {existing ? "Update race result" : "Log your result"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{raceName}</span>
          </p>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div>
            <span className="text-xs font-medium text-gray-500">Official time is</span>
            <div className="mt-1 flex gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="timePrimary"
                  checked={timePrimary === "net"}
                  onChange={() => setTimePrimary("net")}
                />
                Net / chip
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="timePrimary"
                  checked={timePrimary === "gun"}
                  onChange={() => setTimePrimary("gun")}
                />
                Gun
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="lr-finish" className="text-xs font-medium text-gray-500 block">
              Finish time {garminActivityId ? "(optional if activity has duration)" : ""}
            </label>
            <input
              id="lr-finish"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              inputMode="text"
              autoComplete="off"
            />
            <p className="mt-0.5 text-xs text-gray-500">e.g. 3:45:30 or 45:20</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lr-overall" className="text-xs font-medium text-gray-500 block">
                Overall place
              </label>
              <input
                id="lr-overall"
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={overallPlace}
                onChange={(e) => setOverallPlace(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <label htmlFor="lr-ag" className="text-xs font-medium text-gray-500 block">
                Age group
              </label>
              <input
                id="lr-ag"
                type="text"
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={ageGroupPlace}
                onChange={(e) => setAgeGroupPlace(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block">Link Garmin activity (optional)</label>
            {loadingActivities ? (
              <p className="text-sm text-gray-500 mt-1">Loading activities…</p>
            ) : sameDayActivities.length > 0 ? (
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                value={garminActivityId ?? ""}
                onChange={(e) => setGarminActivityId(e.target.value || null)}
              >
                <option value="">None</option>
                {sameDayActivities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.activityName || "Run"} · {a.duration != null ? formatDurationSecondsToClock(a.duration) : "—"}
                    {a.distance != null
                      ? ` · ${(a.distance / 1609.344).toFixed(2)} mi`
                      : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 mt-1">
                No activities on this race date. Enter your time above, or pick from all recent
                activities:
              </p>
            )}
            {sameDayActivities.length === 0 && activities.length > 0 ? (
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                value={garminActivityId ?? ""}
                onChange={(e) => setGarminActivityId(e.target.value || null)}
              >
                <option value="">None</option>
                {activities.slice(0, 30).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.startTime ? new Date(a.startTime).toLocaleDateString() : ""}{" "}
                    {a.activityName || "Run"} ·{" "}
                    {a.duration != null ? formatDurationSecondsToClock(a.duration) : "—"}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div>
            <label htmlFor="lr-notes" className="text-xs font-medium text-gray-500 block">
              Notes
            </label>
            <textarea
              id="lr-notes"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 pb-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : existing ? "Update" : "Save result"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
