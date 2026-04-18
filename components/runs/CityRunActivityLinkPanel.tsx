"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Watch, Loader2, Link2 } from "lucide-react";
import api from "@/lib/api";

type ActivityRow = {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  distance: number | null;
};

type LinkPayload = {
  id: string;
  activityId: string | null;
  activity: {
    id: string;
    activityName: string | null;
    activityType: string | null;
    startTime: string | null;
  } | null;
} | null;

function utcCalendarDaysApart(a: Date, b: Date): number {
  const ua = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const ub = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((ua - ub) / 86400000);
}

function metersToMiShort(m: number | null | undefined): string | null {
  if (m == null || m <= 0) return null;
  const mi = m / 1609.34;
  return `${mi >= 10 ? Math.round(mi) : mi.toFixed(1)} mi`;
}

interface Props {
  runId: string;
  runDateIso: string;
}

export default function CityRunActivityLinkPanel({ runId, runDateIso }: Props) {
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<LinkPayload>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDate = useMemo(() => new Date(runDateIso), [runDateIso]);

  const eligibleActivities = useMemo(() => {
    return activities.filter((a) => {
      if (!a.startTime) return false;
      return utcCalendarDaysApart(runDate, new Date(a.startTime)) <= 1;
    });
  }, [activities, runDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [linkRes, actRes] = await Promise.all([
          api.get(`/runs/${runId}/activity-link`),
          api.get("/activities", { params: { limit: 40 } }),
        ]);
        if (cancelled) return;
        setLink((linkRes.data?.link ?? null) as LinkPayload);
        const list = actRes.data?.activities;
        setActivities(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) {
          setLink(null);
          setActivities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const saveLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/runs/${runId}/activity-link`, {
        activityId: selectedId,
      });
      if (res.data?.link) {
        setLink(res.data.link as LinkPayload);
        setSelectedId("");
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Could not save link");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Garmin link…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
        <Watch className="h-4 w-4 text-gray-400" />
        <h2 className="font-semibold text-gray-900 text-sm">Your Garmin activity</h2>
      </div>
      <div className="p-4 space-y-3">
        {link?.activityId && link.activity ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm">
            <p className="font-medium text-emerald-950">
              Linked: {link.activity.activityName?.trim() || link.activity.activityType || "Activity"}
            </p>
            {link.activity.startTime ? (
              <p className="text-emerald-900/80 text-xs mt-0.5">
                {new Date(link.activity.startTime).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            ) : null}
            <Link
              href={`/activities/${link.activity.id}`}
              className="inline-block mt-2 text-xs font-semibold text-orange-600 hover:text-orange-700"
            >
              View activity →
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-600 leading-relaxed">
              Tie this meetup to a synced run for your history. Only activities within a day of this
              run (UTC) are listed.
            </p>
            {eligibleActivities.length === 0 ? (
              <p className="text-sm text-gray-500">
                No matching activities found. Sync Garmin from Training settings, then refresh this
                page.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700">Pick an activity</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {eligibleActivities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.activityName || a.activityType || "Run").replace(/_/g, " ")}
                      {a.startTime
                        ? ` · ${new Date(a.startTime).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}`
                        : ""}
                      {metersToMiShort(a.distance) ? ` · ${metersToMiShort(a.distance)}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedId || saving}
                  onClick={() => void saveLink()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {saving ? "Saving…" : "Link activity"}
                </button>
              </div>
            )}
          </>
        )}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
