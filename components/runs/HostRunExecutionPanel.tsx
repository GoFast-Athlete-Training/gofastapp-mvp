"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { AthleteHostedRunInvite } from "@/lib/city-run/list-athlete-hosted-invites";
import { runCompletePath } from "@/lib/city-run/run-nav-paths";
import type { CityRunExecutionStatus } from "@prisma/client";

type Props = {
  cityRunId: string;
  className?: string;
};

/** Post–run-day execution controls for athlete-hosted runs (RSVP hub, not edit wizard). */
export default function HostRunExecutionPanel({ cityRunId, className = "" }: Props) {
  const [invite, setInvite] = useState<AthleteHostedRunInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ success: boolean; invite: AthleteHostedRunInvite }>(
        `/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`,
      );
      setInvite(data?.invite ?? null);
    } catch {
      setInvite(null);
      setError("Could not load run status.");
    } finally {
      setLoading(false);
    }
  }, [cityRunId]);

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

  if (loading || !invite) return null;
  if (invite.isUpcoming) return null;

  const segment = invite.slug?.trim() || invite.id;
  const completePath = runCompletePath(segment);

  return (
    <section
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3 ${className}`}
      aria-label="Run execution"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">After run day</p>
        <p className="text-sm text-gray-600 mt-0.5">
          Mark whether this run happened, then match your activity if you attached a workout.
        </p>
      </div>

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

      {invite.cityRunExecutionStatus === "RAN" ? (
        <Link
          href={completePath}
          className="inline-flex text-sm font-semibold text-emerald-800 hover:underline"
        >
          See how the run went →
        </Link>
      ) : null}

      <p className="text-sm text-gray-600">
        {invite.plannedWorkoutId || invite.workoutId
          ? "Link your Garmin activity from Activity after you mark the run Ran."
          : "Attach a workout on Edit run if you want to match an activity later."}
      </p>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
