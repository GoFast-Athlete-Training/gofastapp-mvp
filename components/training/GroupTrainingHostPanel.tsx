"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, Copy, Check } from "lucide-react";
import api from "@/lib/api";
import { formatCohortStartLabel } from "@/lib/training/cohort-display";

type CohortSummary = {
  id: string;
  handle: string;
  cohortName: string;
  defaultPlanStartDate: string | null;
  currentWeekNumber: number | null;
  memberCount: number;
  race: { name: string };
};

type Props = {
  planId: string;
  hasSchedule: boolean;
};

export default function GroupTrainingHostPanel({ planId, hasSchedule }: Props) {
  const [cohort, setCohort] = useState<CohortSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadHostCohort = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/training-cohorts/mine");
      if (res.data?.cohort) {
        setCohort(res.data.cohort as CohortSummary);
      } else {
        setCohort(null);
      }
    } catch {
      setCohort(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasSchedule) void loadHostCohort();
    else setLoading(false);
  }, [hasSchedule, loadHostCohort, planId]);

  const handleOpenGroup = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await api.post("/training-cohorts/from-plan", { open: true });
      if (res.data?.success && res.data.cohort) {
        setCohort(res.data.cohort as CohortSummary);
      } else {
        setError(res.data?.error || "Could not open group training");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Could not open group training");
    } finally {
      setCreating(false);
    }
  };

  const copyJoinLink = async () => {
    if (!cohort?.handle) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/join/training/${encodeURIComponent(cohort.handle)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link");
    }
  };

  if (!hasSchedule || loading) return null;

  const startLabel = formatCohortStartLabel(cohort?.defaultPlanStartDate ?? null);
  const weekNum = cohort?.currentWeekNumber ?? 1;

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-orange-100 p-2 text-orange-700">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Group training</h3>
          {cohort ? (
            <>
              <p className="text-sm text-gray-700 mt-1">{cohort.cohortName}</p>
              {startLabel ? (
                <p className="text-xs text-orange-800 font-medium mt-1">
                  Started {startLabel} · week {weekNum} · {cohort.memberCount} member
                  {cohort.memberCount !== 1 ? "s" : ""}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/join/training/${encodeURIComponent(cohort.handle)}`}
                  className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                >
                  Preview join page
                </Link>
                <button
                  type="button"
                  onClick={() => void copyJoinLink()}
                  className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy invite link"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mt-1">
                Invite others to train for your race with the same plan structure — they get their
                own schedule and paces.
              </p>
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleOpenGroup()}
                className="mt-3 inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {creating ? "Opening…" : "Open group training"}
              </button>
            </>
          )}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
