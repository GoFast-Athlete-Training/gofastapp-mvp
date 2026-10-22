"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import type { AthleteHostedRunInvite } from "@/lib/city-run/list-athlete-hosted-invites";
import { OPEN_RUN_PAGE_LABEL } from "@/lib/city-run/host-run-card-actions";
import { cityRunTogetherPath, runCompletePath } from "@/lib/city-run/run-nav-paths";
import type { CityRunExecutionStatus } from "@prisma/client";

type Props = {
  cityRunId: string;
  onInviteLoaded?: (invite: AthleteHostedRunInvite) => void;
};

export default function HostRunDashboard({ cityRunId, onInviteLoaded }: Props) {
  const [invite, setInvite] = useState<AthleteHostedRunInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [copied, setCopied] = useState<"link" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ success: boolean; invite: AthleteHostedRunInvite }>(
        `/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`,
      );
      if (data?.invite) {
        setInvite(data.invite);
        onInviteLoaded?.(data.invite);
      } else {
        setInvite(null);
      }
    } catch {
      setError("Could not load run dashboard.");
      setInvite(null);
    } finally {
      setLoading(false);
    }
  }, [cityRunId, onInviteLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  const setExecution = async (status: CityRunExecutionStatus) => {
    if (!invite) return;
    setSavingStatus(true);
    setError(null);
    try {
      const { data } = await api.patch<{ success: boolean; invite: AthleteHostedRunInvite }>(
        `/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`,
        { cityRunExecutionStatus: status },
      );
      if (data?.invite) setInvite(data.invite);
    } catch {
      setError("Could not update execution status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const copy = async (text: string, field: "link" | "text") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!invite) {
    return error ? (
      <p className="text-sm text-red-600" role="alert">
        {error}
      </p>
    ) : null;
  }

  const segment = invite.slug?.trim() || invite.id;
  const groupPath = cityRunTogetherPath(segment);
  const completePath = runCompletePath(segment);
  const shareBlock = `${invite.shareText}\n${invite.shareUrl}`;

  return (
    <section className="mb-8 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Run dashboard</p>
        <h2 className="text-lg font-semibold text-gray-900 mt-1">{invite.title}</h2>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-800">
          {invite.rsvpCounts.totalAttending} attending
        </span>
        {invite.rsvpCounts.hosts > 0 ? (
          <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-800">
            {invite.rsvpCounts.hosts} host
          </span>
        ) : null}
        <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-900 capitalize">
          {invite.cityRunExecutionStatus.toLowerCase()}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Share</p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
          {shareBlock}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copy(invite.shareUrl, "link")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Copy className="h-4 w-4" />
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => void copy(shareBlock, "text")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-800"
          >
            <Copy className="h-4 w-4" />
            {copied === "text" ? "Copied" : "Copy message"}
          </button>
          <Link
            href={groupPath}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-800"
          >
            <ExternalLink className="h-4 w-4" />
            {OPEN_RUN_PAGE_LABEL}
          </Link>
          {invite.cityRunExecutionStatus === "RAN" ? (
            <Link
              href={completePath}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900"
            >
              See how the run went
            </Link>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Execution</p>
        <div className="flex flex-wrap gap-2">
          {(["PLANNED", "RAN", "CANCELED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              disabled={savingStatus}
              onClick={() => void setExecution(status)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${
                invite.cityRunExecutionStatus === status
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              } disabled:opacity-50`}
            >
              {status === "PLANNED" ? "Planned" : status === "RAN" ? "Ran" : "Canceled"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Match activity</p>
        <p className="text-sm text-gray-600">
          {invite.plannedWorkoutId || invite.workoutId
            ? "After run day, link your Garmin activity from the run group or Activity."
            : "Add a workout on this invite first, then match an activity."}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
