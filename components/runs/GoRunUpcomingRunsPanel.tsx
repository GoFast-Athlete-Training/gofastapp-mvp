"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RunnerAgendaCard from "@/components/runner/RunnerAgendaCard";
import GoRunStandaloneRunCard from "@/components/runs/GoRunStandaloneRunCard";
import api from "@/lib/api";
import { cityRunTogetherPath } from "@/lib/city-run/run-nav-paths";
import type { RunnerAgendaItem, RunnerAgendaPayload } from "@/lib/runner/runner-agenda";

type Props = {
  /** Home shows previews; full lists every item in each section. */
  mode?: "home" | "full";
};

export default function GoRunUpcomingRunsPanel({ mode = "home" }: Props) {
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
        router.push(cityRunTogetherPath(run.slug?.trim() || run.id));
        return;
      }
      await load();
    } catch (err) {
      console.error("Check-in failed:", err);
    } finally {
      setCheckingInId(null);
    }
  };

  const standaloneRuns = agenda?.upcomingStandaloneRuns ?? [];
  const meetupItems: RunnerAgendaItem[] = agenda?.items ?? [];

  const displayStandalone =
    mode === "home" ? standaloneRuns.slice(0, 1) : standaloneRuns;
  const displayMeetups = mode === "home" ? meetupItems.slice(0, 1) : meetupItems;

  const emptyStandalone = !loading && standaloneRuns.length === 0;
  const emptyMeetups = !loading && meetupItems.length === 0;
  const allEmpty = emptyStandalone && emptyMeetups;

  return (
    <div className="space-y-10 border-t border-gray-200 pt-8">
      {mode === "home" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
          <Link href="/gorun/upcoming" className="text-orange-700 hover:underline">
            All upcoming
          </Link>
          <Link href="/gorun/past-group-runs" className="text-gray-700 hover:underline">
            Past Meetups
          </Link>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : null}

      {allEmpty && !loading ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center space-y-3">
          <p className="text-gray-700 font-medium">Nothing on your Run list yet</p>
          <p className="text-sm text-gray-500">
            Build a run, plan a meetup from that run, or join one from Find a Run.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link
              href="/workouts/create?back=/gorun"
              className="inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Build a run
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

      {!allEmpty && !loading ? (
        <>
          <section aria-label="My upcoming runs">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">My Upcoming Runs</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Sessions you built — open to plan time, route, or invite people.
              </p>
            </div>
            {emptyStandalone ? (
              <p className="text-sm text-gray-500">No standalone runs ahead.</p>
            ) : (
              <div className="space-y-4">
                {displayStandalone.map((run) => (
                  <GoRunStandaloneRunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="My upcoming meetups">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">My Upcoming Meetups</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                City runs you host or joined — group page, copy link, check-in.
              </p>
            </div>
            {emptyMeetups ? (
              <p className="text-sm text-gray-500">No meetups on the calendar yet.</p>
            ) : (
              <div className="space-y-4">
                {displayMeetups.map((item) => (
                  <RunnerAgendaCard
                    key={item.id}
                    item={item}
                    checkingInId={checkingInId}
                    onCheckin={(runId) => void handleCheckin(runId)}
                    onDeleted={() => void load()}
                    hideMembershipBadge={mode === "home"}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
