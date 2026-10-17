"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RunnerAgendaCard from "@/components/runner/RunnerAgendaCard";
import GoRunPastSections from "@/components/runs/GoRunPastSections";
import { pastGroupRunItems } from "@/lib/runner/past-run-sections";
import api from "@/lib/api";
import type { RunnerAgendaItem, RunnerAgendaPayload } from "@/lib/runner/runner-agenda";

export default function GoRunUpcomingRunsPanel() {
  const router = useRouter();
  const [agenda, setAgenda] = useState<RunnerAgendaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/me/runner");
      setAgenda(res.data as RunnerAgendaPayload);
    } catch (err) {
      console.error("GoRun upcoming runs load failed:", err);
      setAgenda(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCheckin = async (runId: string) => {
    const item = agenda?.items.find((i) => i.joinedRun?.id === runId);
    const run = item?.joinedRun;
    setCheckingInId(runId);
    try {
      await api.post(`/runs/${runId}/checkin`, {});
      if (run?.slug || run?.id) {
        const segment = encodeURIComponent(run.slug?.trim() || run.id);
        router.push(`/cityruntogether/${segment}`);
        return;
      }
      await load();
    } catch (err) {
      console.error("Check-in failed:", err);
    } finally {
      setCheckingInId(null);
    }
  };

  const items: RunnerAgendaItem[] = agenda?.items ?? [];
  const pastItems: RunnerAgendaItem[] = agenda?.pastItems ?? [];
  const pastGroupCount = pastGroupRunItems(pastItems).length;
  const empty = !loading && items.length === 0 && pastGroupCount === 0;

  return (
    <section className="space-y-4 border-t border-gray-200 pt-8" aria-label="My upcoming runs">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">My upcoming runs</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          City runs you created or joined — open the run group for details and chatter.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center space-y-3">
          <p className="text-gray-700 font-medium">No runs on your list yet</p>
          <p className="text-sm text-gray-500">Host a run or join one from Find a Run.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link
              href="/host-a-run"
              className="inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Create a run
            </Link>
            <Link
              href="/discoverruns"
              className="inline-flex rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Find a run
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <RunnerAgendaCard
              key={item.id}
              item={item}
              checkingInId={checkingInId}
              onCheckin={(runId) => void handleCheckin(runId)}
              onDeleted={() => void load()}
            />
          ))}
        </div>
      ) : null}

      {!loading ? <GoRunPastSections /> : null}
    </section>
  );
}
