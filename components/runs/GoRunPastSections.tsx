"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RunnerAgendaCard from "@/components/runner/RunnerAgendaCard";
import PastTrainingWorkoutRow from "@/components/runner/PastTrainingWorkoutRow";
import api from "@/lib/api";
import type { RunnerAgendaItem, RunnerAgendaPayload } from "@/lib/runner/runner-agenda";
import {
  PAST_RUN_PREVIEW_LIMIT,
  pastGroupRunItems,
  pastTrainingWorkoutItems,
} from "@/lib/runner/past-run-sections";

type Props = {
  /** When true, show full lists (see-more pages). */
  expanded?: boolean;
  /** Which blocks to render on /gorun vs dedicated see-more routes. */
  mode?: "all" | "group" | "training";
};

export default function GoRunPastSections({ expanded = false, mode = "all" }: Props) {
  const [agenda, setAgenda] = useState<RunnerAgendaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/me/runner");
      setAgenda(res.data as RunnerAgendaPayload);
    } catch {
      setAgenda(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pastItems = agenda?.pastItems ?? [];
  const groupRuns = pastGroupRunItems(pastItems);
  const trainingRows = pastTrainingWorkoutItems(pastItems);

  const groupPreview = expanded ? groupRuns : groupRuns.slice(0, PAST_RUN_PREVIEW_LIMIT);
  const trainingPreview = expanded ? trainingRows : trainingRows.slice(0, PAST_RUN_PREVIEW_LIMIT);

  const handleCheckin = async (runId: string) => {
    setCheckingInId(runId);
    try {
      await api.post(`/runs/${runId}/checkin`, {});
      await load();
    } catch {
      /* ignore */
    } finally {
      setCheckingInId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 border-t border-gray-200 pt-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const showGroup = mode === "all" || mode === "group";
  const showTraining = mode === "all" || mode === "training";

  return (
    <div
      className={
        mode === "all" ? "space-y-10 border-t border-gray-200 pt-8" : "space-y-4"
      }
    >
      {showGroup ? (
      <section aria-label="Past meetups">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Past Meetups</h2>
            <p className="text-sm text-gray-600 mt-0.5">Meetups you hosted or joined.</p>
          </div>
          {!expanded && groupRuns.length > PAST_RUN_PREVIEW_LIMIT ? (
            <Link
              href="/gorun/past-group-runs"
              className="text-sm font-semibold text-sky-700 hover:text-sky-800 shrink-0"
            >
              See more
            </Link>
          ) : null}
        </div>
        {groupPreview.length === 0 ? (
          <p className="text-sm text-gray-500">No past group runs yet.</p>
        ) : (
          <div className="space-y-4">
            {groupPreview.map((item) => (
              <RunnerAgendaCard
                key={item.id}
                item={item}
                checkingInId={checkingInId}
                onCheckin={(runId) => void handleCheckin(runId)}
                onDeleted={() => void load()}
              />
            ))}
          </div>
        )}
      </section>
      ) : null}

      {showTraining ? (
      <section aria-label="My past training workouts">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Past Training Workouts</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Workouts tied to a group run you did.
            </p>
          </div>
          {!expanded && trainingRows.length > PAST_RUN_PREVIEW_LIMIT ? (
            <Link
              href="/gorun/past-training-workouts"
              className="text-sm font-semibold text-sky-700 hover:text-sky-800 shrink-0"
            >
              See more
            </Link>
          ) : null}
        </div>
        {trainingPreview.length === 0 ? (
          <p className="text-sm text-gray-500">No past training workouts on your runs yet.</p>
        ) : (
          <div className="space-y-3">
            {trainingPreview.map((item) => (
              <PastTrainingWorkoutRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}
