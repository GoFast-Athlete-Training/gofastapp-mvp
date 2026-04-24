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
    return activities
      .filter((a) => {
        if (!a.startTime) return false;
        const days = Math.abs(utcCalendarDaysApart(runDate, new Date(a.startTime)));
        return days <= 1;
      })
      .sort((a, b) => {
        const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
        const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
        return tb - ta;
      });
  }, [activities, runDate]);

  useEffect(() => {
    let cancelled = false;
    setSelectedId("");
    setActivities([]);
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

  useEffect(() => {
    if (eligibleActivities.length === 1 && !selectedId) {
      setSelectedId(eligibleActivities[0].id);
    }
  }, [eligibleActivities, selectedId]);

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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Garmin link…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
              Tie this meetup to a synced run for your history. Only activities within one calendar day of this
              run (UTC) are shown.
            </p>
            {eligibleActivities.length === 0 ? (
              <p className="text-sm text-gray-500">
                No matching activities found. Sync Garmin from Training settings, then refresh this
                page.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-gray-700">Pick an activity</p>
                <div className="space-y-2 max-h-[min(20rem,45vh)] overflow-y-auto pr-1">
                  {eligibleActivities.map((a) => {
                    const selected = selectedId === a.id;
                    const title = (a.activityName || a.activityType || "Run").replace(/_/g, " ");
                    const when = a.startTime
                      ? new Date(a.startTime).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : null;
                    const dist = metersToMiShort(a.distance);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                          selected
                            ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{title}</p>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-600">
                          {a.activityType ? (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">
                              {a.activityType.replace(/_/g, " ")}
                            </span>
                          ) : null}
                          {when ? <span>{when}</span> : null}
                          {dist ? <span>{dist}</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
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
